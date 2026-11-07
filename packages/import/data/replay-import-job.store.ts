import { computed, effect, inject, untracked } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods } from '@ngrx/signals';
import {
  addEntity,
  removeEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { injectPlatform } from '@myrddraall/heroes-replay-stats-platform/data';
import type { PickedReplay } from '@myrddraall/heroes-replay-stats-platform/model';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import {
  analysersOf,
  type ImportJob,
  type ImportJobStatus,
  type ImportOverall,
  progressOf,
  type ReplayImportProgress,
  type ReplayInput,
  storeOf,
} from '../model';
import { IngestPool } from './ingest-pool';

let nextId = 1;

/** The `N` in a job's `job-N` id: strictly increasing in creation order, so it doubles
 * as a tie-breaker for "newest first" without depending on wall-clock time. */
function sequenceOf(job: ImportJob): number {
  return Number(job.id.slice(job.id.lastIndexOf('-') + 1)) || 0;
}

export const IMPORT_JOBS_STORAGE_KEY = 'hrs.import-jobs';
export const INTERRUPTED = 'Interrupted: the page was reloaded during the import';

/** A job read back from storage cannot resume — the bytes and the worker are gone. */
function interrupt(job: ImportJob): ImportJob {
  const analysers = job.analysers.map((a) =>
    a.state === 'queued' || a.state === 'running'
      ? { ...a, state: 'failed' as const, error: INTERRUPTED }
      : a,
  );
  if (job.status === 'queued' || job.status === 'running') {
    return {
      ...job,
      status: 'failed',
      phase: 'failed',
      error: INTERRUPTED,
      analysers,
      store: null,
    };
  }
  return { ...job, analysers, store: null };
}

function loadJobs(): ImportJob[] {
  try {
    const raw = sessionStorage.getItem(IMPORT_JOBS_STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ImportJob[]).map(interrupt);
  } catch {
    return [];
  }
}

function saveJobs(jobs: readonly ImportJob[]): void {
  try {
    sessionStorage.setItem(IMPORT_JOBS_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // storage unavailable or full: the list still works for this page load
  }
}

/**
 * Imports replays and tracks each import as a job with its phase, progress and the
 * state of every analyser the worker runs. Jobs are kept in `sessionStorage`, so they
 * survive a reload but not the tab; a job that was still running is shown as failed.
 */
export const ReplayImportJobStore = signalStore(
  { providedIn: 'root' },
  withEntities<ImportJob>(),
  withHooks({
    onInit(store) {
      const jobs = loadJobs();
      for (const job of jobs) {
        const n = Number(job.id.replace(/^job-/, ''));
        if (Number.isInteger(n) && n >= nextId) nextId = n + 1;
      }
      patchState(store, setAllEntities(jobs));
      effect(() => saveJobs(store.entities()));
    },
  }),
  withComputed(({ entities }) => ({
    /**
     * In groups: jobs in progress (running, or ready with background analysers still
     * going), then queued ones, then finished ones (complete or failed). Newest first
     * within each group, by creation order via each job's id sequence.
     */
    jobs: computed(() => {
      const GROUP: Readonly<Record<ImportJobStatus, number>> = {
        running: 0,
        ready: 0,
        queued: 1,
        complete: 2,
        failed: 2,
      };
      return [...entities()].sort((a, b) => {
        const byRank = GROUP[a.status] - GROUP[b.status];
        return byRank !== 0 ? byRank : sequenceOf(b) - sequenceOf(a);
      });
    }),
    /**
     * Each replay with an import job still going (by replay id, once the file is read): its
     * stage and progress.
     */
    progressByReplay: computed((): ReadonlyMap<string, ReplayImportProgress> => {
      const STAGE: Partial<Record<ImportJobStatus, ReplayImportProgress['stage']>> = {
        running: 'importing',
        ready: 'analysing',
      };
      return new Map(
        entities().flatMap((j) => {
          const stage = STAGE[j.status];
          return stage && j.replayId !== null
            ? [[j.replayId, { stage, progress: j.progress }] as const]
            : [];
        }),
      );
    }),
    overall: computed((): ImportOverall => {
      const jobs = entities();
      const count = (status: ImportJobStatus) => jobs.filter((j) => j.status === status).length;
      const running = count('running');
      const queued = count('queued');
      return {
        total: jobs.length,
        queued,
        running,
        done: count('ready') + count('complete'),
        failed: count('failed'),
        progress: jobs.length === 0 ? 1 : jobs.reduce((a, j) => a + j.progress, 0) / jobs.length,
        active: running + queued > 0,
      };
    }),
  })),
  withMethods(
    (
      store,
      pool = inject(IngestPool),
      settings = inject(SettingsStore),
      platform = injectPlatform(),
    ) => {
      /** Queued jobs' bytes (never persisted) and the callback that settles their `import()`. */
      const pending = new Map<string, { bytes: Uint8Array; settle: () => void }>();
      let active = 0;

      async function toPicked(input: ReplayInput, fileName?: string): Promise<PickedReplay[]> {
        if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
          return [
            {
              name: fileName ?? 'replay.StormReplay',
              bytes: input instanceof Uint8Array ? input : new Uint8Array(input),
            },
          ];
        }
        const items: (File | FileSystemFileHandle | PickedReplay)[] =
          input instanceof FileList
            ? [...input]
            : Array.isArray(input)
              ? [...input]
              : [input as File | FileSystemFileHandle | PickedReplay];
        return Promise.all(
          items.map(async (item): Promise<PickedReplay> => {
            const file =
              item instanceof File ? item : 'getFile' in item ? await item.getFile() : undefined;
            if (file === undefined) return item as PickedReplay;
            return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
          }),
        );
      }

      const update = (id: string, changes: Partial<ImportJob>): void => {
        if (store.entityMap()[id]) patchState(store, updateEntity({ id, changes }));
      };

      /** Runs one job on a free worker to completion; failures land in the job, never thrown. */
      async function run(job: ImportJob, bytes: Uint8Array, limit: number): Promise<void> {
        update(job.id, { status: 'running', startedAt: Date.now() });
        let slot: Awaited<ReturnType<IngestPool['acquire']>> | undefined;
        try {
          slot = await pool.acquire(limit);
          const handle = slot.client.ingest(bytes, {
            fileName: job.fileName,
            onStatus: (s) =>
              update(job.id, {
                phase: s.phase,
                progress: progressOf(s),
                replayId: s.replayId,
                analysers: analysersOf(s),
                store: storeOf(s),
              }),
          });
          handle.ready.then(
            (r) => update(job.id, { status: 'ready', replayId: r.replayId }),
            () => undefined,
          );
          const r = await handle.complete;
          update(job.id, {
            status: 'complete',
            phase: 'complete',
            progress: 1,
            replayId: r.replayId,
            store: null,
            finishedAt: Date.now(),
          });
        } catch (err) {
          update(job.id, {
            status: 'failed',
            phase: 'failed',
            error: err instanceof Error ? err.message : String(err),
            store: null,
            finishedAt: Date.now(),
          });
        } finally {
          if (slot) pool.release(slot, settings.parallelImports());
        }
      }

      /** Start queued jobs, oldest first, while fewer than the parallel limit are running. */
      function pump(): void {
        const limit = settings.parallelImports();
        while (active < limit) {
          const next = store
            .entities()
            .filter((j) => j.status === 'queued' && pending.has(j.id))
            .sort((a, b) => sequenceOf(a) - sequenceOf(b))[0];
          if (!next) return;
          const { bytes, settle } = pending.get(next.id)!;
          pending.delete(next.id);
          active++;
          void run(next, bytes, limit).finally(() => {
            active--;
            settle();
            pump();
          });
        }
      }

      // A higher limit starts waiting jobs at once; a lower one closes idle workers.
      effect(() => {
        const limit = settings.parallelImports();
        untracked(() => {
          pool.trim(limit);
          pump();
        });
      });

      return {
        /**
         * Import replays. With no argument, opens the platform's file dialog; otherwise takes
         * replay bytes (with an optional file name), `File`s, a `FileList`,
         * `FileSystemFileHandle`s, or already-picked replays — singly or as arrays. Every
         * file becomes a queued job at once; up to the "parallel imports" setting run at the
         * same time, each in its own worker, oldest first. Resolves with the jobs once they
         * have all finished, one way or the other (or were dismissed while queued).
         */
        async import(input?: ReplayInput, fileName?: string): Promise<ImportJob[]> {
          const picked =
            input === undefined ? await platform.pickReplays() : await toPicked(input, fileName);
          const ids: string[] = [];
          const settled: Promise<void>[] = [];
          for (const file of picked) {
            const id = `job-${nextId++}`;
            ids.push(id);
            const created: ImportJob = {
              id,
              fileName: file.name,
              bytes: file.bytes.byteLength,
              status: 'queued',
              phase: null,
              progress: 0,
              replayId: null,
              error: null,
              analysers: [],
              store: null,
              startedAt: null,
              finishedAt: null,
            };
            patchState(store, addEntity(created));
            settled.push(
              new Promise((settle) =>
                pending.set(id, { bytes: file.bytes, settle: () => settle() }),
              ),
            );
          }
          pump();
          await Promise.all(settled);
          return ids
            .map((id) => store.entityMap()[id])
            .filter((j): j is ImportJob => j !== undefined);
        },

        /** Drop one job from the list (a running job keeps running in its worker; a queued one never starts). */
        dismiss(id: string): void {
          const queued = pending.get(id);
          pending.delete(id);
          queued?.settle();
          patchState(store, removeEntity(id));
        },

        /** Drop every finished job. */
        clearFinished(): void {
          patchState(
            store,
            removeEntities((j) => j.status === 'complete' || j.status === 'failed'),
          );
        },
      };
    },
  ),
);
