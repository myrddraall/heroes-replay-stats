import { computed, effect, inject } from '@angular/core';
import type { IngestPhase, IngestStatus } from '@myrddraall/heroprotocol-db/ingest';
import { patchState, signalStore, withComputed, withHooks, withMethods } from '@ngrx/signals';
import {
  addEntity,
  removeEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { injectPlatform } from '../../platform/platform';
import type { PickedReplay } from '../../platform/platform';
import { REPLAY_DB } from './provide-replay-db';

export type ImportJobStatus = 'queued' | 'running' | 'ready' | 'complete' | 'failed';

export interface ImportAnalyserState {
  readonly id: string;
  readonly mode: 'ready' | 'background' | 'lazy';
  readonly state: 'queued' | 'running' | 'done' | 'cached' | 'failed';
  /** 0..1 when the analyser reports progress, else null. */
  readonly progress: number | null;
  readonly ms: number | null;
  readonly error: string | null;
}

/** One replay file being imported. Kept in `sessionStorage` for the life of the tab. */
export interface ImportJob {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly status: ImportJobStatus;
  /** The worker's phase; null until it starts. */
  readonly phase: IngestPhase | null;
  /** 0..1 across the whole pipeline. */
  readonly progress: number;
  readonly replayId: string | null;
  readonly error: string | null;
  readonly analysers: readonly ImportAnalyserState[];
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}

export interface ImportOverall {
  readonly total: number;
  readonly queued: number;
  readonly running: number;
  readonly done: number;
  readonly failed: number;
  /** 0..1, the mean of every job's progress; 1 when there are no jobs. */
  readonly progress: number;
  readonly active: boolean;
}

/** Anything `import()` accepts besides "open the dialog". */
export type ReplayInput =
  | Uint8Array
  | ArrayBuffer
  | File
  | FileList
  | FileSystemFileHandle
  | PickedReplay
  | readonly (File | FileSystemFileHandle | PickedReplay)[];

/** Where each phase sits on the 0..1 progress line; within a phase, the worker's own counters interpolate. */
const PHASE_SPAN: Readonly<Record<IngestPhase, readonly [number, number]>> = {
  parsing: [0, 0.55],
  normalizing: [0.55, 0.6],
  writing: [0.6, 0.7],
  'analysing-ready': [0.7, 0.85],
  'analysing-background': [0.85, 1],
  'analysing-lazy': [1, 1],
  complete: [1, 1],
  failed: [0, 0],
};

/** A job's progress from one status snapshot. */
export function progressOf(s: IngestStatus): number {
  const [from, to] = PHASE_SPAN[s.phase];
  let fraction = 0;
  if (s.phase === 'parsing') {
    const measured = Object.values(s.sections).filter((x) => x.total !== undefined && x.total > 0);
    const done = Object.values(s.sections).filter(
      (x) => x.state === 'ok' || x.state === 'partial' || x.state === 'failed',
    ).length;
    const partial = measured.reduce((a, x) => a + Math.min(1, (x.current ?? 0) / x.total!), 0);
    fraction = Math.max(done, partial) / Math.max(1, Object.keys(s.sections).length);
  } else if (s.phase === 'analysing-ready' || s.phase === 'analysing-background') {
    const mode = s.phase === 'analysing-ready' ? 'ready' : 'background';
    const mine = Object.values(s.analysers).filter((a) => a.mode === mode);
    const finished = mine.filter(
      (a) => a.state === 'done' || a.state === 'cached' || a.state === 'failed',
    ).length;
    fraction = mine.length === 0 ? 1 : finished / mine.length;
  }
  return from + (to - from) * Math.min(1, Math.max(0, fraction));
}

export function analysersOf(s: IngestStatus): ImportAnalyserState[] {
  return Object.entries(s.analysers).map(([id, a]) => ({
    id,
    mode: a.mode,
    state: a.state,
    progress: a.progress && a.progress.total > 0 ? a.progress.current / a.progress.total : null,
    ms: a.ms ?? null,
    error: a.error ?? null,
  }));
}

let nextId = 1;

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
    return { ...job, status: 'failed', phase: 'failed', error: INTERRUPTED, analysers };
  }
  return job.status === 'ready' ? { ...job, analysers } : job;
}

function loadJobs(): ImportJob[] {
  try {
    const raw = sessionStorage.getItem(IMPORT_JOBS_STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportJob[]).map(interrupt) : [];
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
    jobs: computed(() => entities()),
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
  withMethods((store, db = inject(REPLAY_DB), platform = injectPlatform()) => {
    let chain: Promise<void> = Promise.resolve();

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

    /** Runs one job to completion; failures land in the job, never thrown. */
    async function run(job: ImportJob, bytes: Uint8Array): Promise<void> {
      update(job.id, { status: 'running', startedAt: Date.now() });
      const handle = db.ingest(bytes, {
        fileName: job.fileName,
        onStatus: (s) =>
          update(job.id, {
            phase: s.phase,
            progress: progressOf(s),
            replayId: s.replayId,
            analysers: analysersOf(s),
          }),
      });
      handle.ready.then(
        (r) => update(job.id, { status: 'ready', replayId: r.replayId }),
        () => undefined,
      );
      try {
        const r = await handle.complete;
        update(job.id, {
          status: 'complete',
          phase: 'complete',
          progress: 1,
          replayId: r.replayId,
          finishedAt: Date.now(),
        });
      } catch (err) {
        update(job.id, {
          status: 'failed',
          phase: 'failed',
          error: err instanceof Error ? err.message : String(err),
          finishedAt: Date.now(),
        });
      }
    }

    return {
      /**
       * Import replays. With no argument, opens the platform's file dialog; otherwise takes
       * replay bytes (with an optional file name), `File`s, a `FileList`,
       * `FileSystemFileHandle`s, or already-picked replays — singly or as arrays. Every
       * file becomes a queued job at once; jobs run one at a time. Resolves with the jobs
       * once they have all finished, one way or the other.
       */
      async import(input?: ReplayInput, fileName?: string): Promise<ImportJob[]> {
        const picked =
          input === undefined ? await platform.pickReplays() : await toPicked(input, fileName);
        const ids: string[] = [];
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
            startedAt: null,
            finishedAt: null,
          };
          patchState(store, addEntity(created));
          const job = store.entityMap()[id]!;
          chain = chain.then(() => (store.entityMap()[id] ? run(job, file.bytes) : undefined));
        }
        await chain;
        return ids
          .map((id) => store.entityMap()[id])
          .filter((j): j is ImportJob => j !== undefined);
      },

      /** Drop one job from the list (a running job keeps running in the worker). */
      dismiss(id: string): void {
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
  }),
);
