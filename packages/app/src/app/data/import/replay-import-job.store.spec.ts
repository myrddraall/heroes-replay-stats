import { TestBed } from '@angular/core/testing';
import type { IngestJob, ReplayDbClient } from '@myrddraall/heroprotocol-db/client';
import type { IngestStatus } from '@myrddraall/heroprotocol-db/ingest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PLATFORM, type PickedReplay, type Platform } from '../../platform/platform';
import { REPLAY_DB } from './provide-replay-db';
import {
  IMPORT_JOBS_STORAGE_KEY,
  INTERRUPTED,
  ReplayImportJobStore,
  progressOf,
} from './replay-import-job.store';

/** A scripted worker: each ingest is driven by the test through `drive`. */
interface Scripted {
  fileName: string;
  status: (s: IngestStatus) => void;
  ready: (replayId: string) => void;
  complete: (replayId: string) => void;
  fail: (message: string) => void;
}

const status = (over: Partial<IngestStatus>): IngestStatus => ({
  jobId: 1,
  fileName: 'x',
  replayId: null,
  phase: 'parsing',
  sections: {
    header: { state: 'ok' },
    details: { state: 'ok' },
    initData: { state: 'ok' },
    attributes: { state: 'ok' },
    trackerEvents: { state: 'running', current: 50, total: 100 },
    messageEvents: { state: 'pending' },
    gameEvents: { state: 'pending' },
  },
  analysers: {},
  timingsMs: {},
  ...over,
});

describe('ReplayImportJobStore', () => {
  let scripted: Scripted[];
  let pick: PickedReplay[];

  beforeEach(() => {
    sessionStorage.clear();
    scripted = [];
    pick = [];
    const db = {
      ingest: (
        _bytes: Uint8Array | ArrayBuffer,
        options: { fileName: string; onStatus?: (s: IngestStatus) => void },
      ): IngestJob => {
        let resolveReady!: (v: unknown) => void;
        let resolveComplete!: (v: unknown) => void;
        let rejectComplete!: (e: unknown) => void;
        const ready = new Promise((r) => (resolveReady = r));
        const complete = new Promise((r, j) => {
          resolveComplete = r;
          rejectComplete = j;
        });
        ready.catch(() => undefined);
        complete.catch(() => undefined);
        const result = (replayId: string) => ({
          replayId,
          replay: { id: replayId },
          jobId: 1,
          status: status({}),
        });
        scripted.push({
          fileName: options.fileName,
          status: (s) => options.onStatus?.(s),
          ready: (id) => resolveReady(result(id)),
          complete: (id) => resolveComplete(result(id)),
          fail: (m) => rejectComplete(new Error(m)),
        });
        return {
          ready,
          complete,
          status: () => () => undefined,
          latest: undefined,
        } as unknown as IngestJob;
      },
    } as unknown as ReplayDbClient;
    const platform: Platform = {
      kind: 'web',
      version: 't',
      pickReplays: async () => pick,
      defaultReplayDirectory: async () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: REPLAY_DB, useValue: db },
        { provide: PLATFORM, useValue: platform },
      ],
    });
  });

  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('queues one job per file, runs them one at a time, and tracks phase, progress and analysers', async () => {
    pick = [
      { name: 'a.StormReplay', bytes: new Uint8Array(10) },
      { name: 'b.StormReplay', bytes: new Uint8Array(20) },
    ];
    const store = TestBed.inject(ReplayImportJobStore);
    const byName = (name: string) => store.jobs().find((j) => j.fileName === name)!;
    const done = store.import();
    await tick();
    expect(byName('a.StormReplay')).toMatchObject({ status: 'running', bytes: 10 });
    expect(byName('b.StormReplay')).toMatchObject({ status: 'queued', bytes: 20 });
    // Both jobs are in progress; b is newer (queued after a), so it sorts on top.
    expect(store.jobs().map((j) => j.fileName)).toEqual(['b.StormReplay', 'a.StormReplay']);
    expect(scripted).toHaveLength(1); // b has not been handed to the worker yet
    expect(store.overall()).toMatchObject({
      total: 2,
      queued: 1,
      running: 1,
      done: 0,
      failed: 0,
      active: true,
    });

    scripted[0]!.status(status({ replayId: 'r-a' }));
    let a = byName('a.StormReplay');
    expect(a.phase).toBe('parsing');
    expect(a.replayId).toBe('r-a');
    expect(a.progress).toBeGreaterThan(0.3);
    expect(a.progress).toBeLessThan(0.55);

    scripted[0]!.status(
      status({
        phase: 'analysing-ready',
        analysers: {
          x: { state: 'done', mode: 'ready', ms: 3 },
          y: { state: 'running', mode: 'ready', progress: { current: 1, total: 4 } },
          z: { state: 'queued', mode: 'background' },
        },
      }),
    );
    a = byName('a.StormReplay');
    expect(a.analysers).toEqual([
      { id: 'x', mode: 'ready', state: 'done', progress: null, ms: 3, error: null },
      { id: 'y', mode: 'ready', state: 'running', progress: 0.25, ms: null, error: null },
      { id: 'z', mode: 'background', state: 'queued', progress: null, ms: null, error: null },
    ]);
    expect(a.progress).toBeCloseTo(0.7 + 0.15 * 0.5, 5);

    scripted[0]!.ready('r-a');
    await tick();
    expect(byName('a.StormReplay').status).toBe('ready');
    scripted[0]!.complete('r-a');
    await tick();
    await tick();
    expect(byName('a.StormReplay')).toMatchObject({
      status: 'complete',
      phase: 'complete',
      progress: 1,
    });
    expect(byName('b.StormReplay').status).toBe('running'); // b started only after a finished
    // a finished, so b (running) stays on top even though a was queued first.
    expect(store.jobs().map((j) => j.fileName)).toEqual(['b.StormReplay', 'a.StormReplay']);
    expect(scripted).toHaveLength(2);

    scripted[1]!.fail('parse failed: not a replay');
    const jobs = await done;
    expect(jobs.map((j) => [j.fileName, j.status, j.error])).toEqual([
      ['a.StormReplay', 'complete', null],
      ['b.StormReplay', 'failed', 'parse failed: not a replay'],
    ]);
    expect(store.overall()).toMatchObject({
      total: 2,
      done: 1,
      failed: 1,
      active: false,
      progress: 0.5,
    });
  });

  it('accepts bytes, Files, FileLists and handles; a cancelled dialog makes no jobs', async () => {
    const store = TestBed.inject(ReplayImportJobStore);
    const finishAll = async (p: Promise<unknown>) => {
      await tick();
      // Look the running job up by name rather than position: jobs() is sorted
      // (in-progress first, newest first), so its index has no fixed relation to
      // `scripted`'s push order.
      let running = store.jobs().find((j) => j.status === 'running');
      while (running) {
        const i = scripted.findIndex((s) => s.fileName === running!.fileName);
        scripted[i]!.complete(`r-${running.id}`);
        await tick();
        await tick();
        running = store.jobs().find((j) => j.status === 'running');
      }
      return p;
    };
    await finishAll(store.import(new Uint8Array([1]), 'bytes.StormReplay'));
    await finishAll(store.import(new File([new Uint8Array([2])], 'file.StormReplay')));
    const handle = {
      kind: 'file',
      name: 'handle.StormReplay',
      getFile: async () => new File([new Uint8Array([3])], 'handle.StormReplay'),
    } as unknown as FileSystemFileHandle;
    await finishAll(store.import([handle]));
    // All three finished, each imported after the last, so the newest is on top.
    expect(store.jobs().map((j) => j.fileName)).toEqual([
      'handle.StormReplay',
      'file.StormReplay',
      'bytes.StormReplay',
    ]);
    expect(store.jobs().every((j) => j.status === 'complete')).toBe(true);
    expect(await store.import()).toEqual([]);
    expect(store.jobs()).toHaveLength(3);

    store.dismiss(store.jobs()[0]!.id); // the newest, handle.StormReplay
    expect(store.jobs().map((j) => j.fileName)).toEqual(['file.StormReplay', 'bytes.StormReplay']);
    store.clearFinished();
    expect(store.jobs()).toEqual([]);
    expect(store.overall()).toMatchObject({ total: 0, progress: 1, active: false });
  });

  it('keeps jobs in sessionStorage; a job still running at reload comes back as failed', async () => {
    pick = [
      { name: 'a.StormReplay', bytes: new Uint8Array(1) },
      { name: 'b.StormReplay', bytes: new Uint8Array(1) },
    ];
    const store = TestBed.inject(ReplayImportJobStore);
    void store.import();
    await tick();
    scripted[0]!.complete('r-a');
    await tick();
    await tick();
    scripted[1]!.status(
      status({
        phase: 'analysing-ready',
        analysers: {
          x: { state: 'done', mode: 'ready', ms: 1 },
          y: { state: 'running', mode: 'ready' },
        },
      }),
    );
    TestBed.tick();
    const saved = JSON.parse(sessionStorage.getItem(IMPORT_JOBS_STORAGE_KEY)!) as unknown[];
    expect(saved).toHaveLength(2);
    // b is still running (in progress), so it sorts above the already-complete a.
    expect(store.jobs().map((j) => j.fileName)).toEqual(['b.StormReplay', 'a.StormReplay']);
    const ids = store.jobs().map((j) => j.id);

    // A fresh app in the same tab: same providers, new store instance.
    const providers = TestBed.inject(REPLAY_DB);
    const platform = TestBed.inject(PLATFORM);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: REPLAY_DB, useValue: providers },
        { provide: PLATFORM, useValue: platform },
      ],
    });
    const restored = TestBed.inject(ReplayImportJobStore);
    // Both jobs are now finished; b is newer than a (queued after it), so it stays on top.
    expect(restored.jobs().map((j) => [j.id, j.fileName, j.status, j.error])).toEqual([
      [ids[0], 'b.StormReplay', 'failed', INTERRUPTED],
      [ids[1], 'a.StormReplay', 'complete', null],
    ]);
    expect(restored.jobs()[0]!.analysers.map((a) => [a.id, a.state, a.error])).toEqual([
      ['x', 'done', null],
      ['y', 'failed', INTERRUPTED],
    ]);

    // New jobs never reuse a restored id.
    pick = [{ name: 'c.StormReplay', bytes: new Uint8Array(1) }];
    void restored.import();
    await tick();
    expect(new Set(restored.jobs().map((j) => j.id)).size).toBe(3);
    scripted.at(-1)!.complete('r-c');
    await tick();
    await tick();
    TestBed.tick();
    expect(
      (JSON.parse(sessionStorage.getItem(IMPORT_JOBS_STORAGE_KEY)!) as { status: string }[]).map(
        (j) => j.status,
      ),
    ).toEqual(['complete', 'failed', 'complete']);
  });

  it('orders jobs newest to oldest, with in-progress jobs always on top', async () => {
    const store = TestBed.inject(ReplayImportJobStore);

    pick = [{ name: 'first.StormReplay', bytes: new Uint8Array(1) }];
    const p1 = store.import();
    await tick();
    scripted[0]!.complete('r1');
    await p1;
    expect(store.jobs().map((j) => j.fileName)).toEqual(['first.StormReplay']);

    pick = [{ name: 'second.StormReplay', bytes: new Uint8Array(1) }];
    const p2 = store.import();
    await tick();
    // second is in progress, so it jumps above the already-finished first.
    expect(store.jobs().map((j) => j.fileName)).toEqual([
      'second.StormReplay',
      'first.StormReplay',
    ]);
    scripted[1]!.complete('r2');
    await p2;
    // both finished now: second was imported after first, so it stays newest-first.
    expect(store.jobs().map((j) => j.fileName)).toEqual([
      'second.StormReplay',
      'first.StormReplay',
    ]);

    pick = [{ name: 'third.StormReplay', bytes: new Uint8Array(1) }];
    const p3 = store.import();
    await tick();
    // third is in progress, so it jumps above both finished jobs.
    expect(store.jobs().map((j) => j.fileName)).toEqual([
      'third.StormReplay',
      'second.StormReplay',
      'first.StormReplay',
    ]);
    scripted[2]!.complete('r3');
    await p3;
    expect(store.jobs().map((j) => j.fileName)).toEqual([
      'third.StormReplay',
      'second.StormReplay',
      'first.StormReplay',
    ]);
  });

  it('maps every phase onto the 0..1 line in order', () => {
    const phases = [
      'parsing',
      'normalizing',
      'writing',
      'analysing-ready',
      'analysing-background',
      'complete',
    ] as const;
    const values = phases.map((phase) =>
      progressOf(status({ phase, sections: status({}).sections })),
    );
    for (let i = 1; i < values.length; i++)
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]!);
    expect(values.at(-1)).toBe(1);
    expect(progressOf(status({ phase: 'failed' }))).toBe(0);
  });
});
