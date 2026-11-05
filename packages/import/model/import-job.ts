import type { IngestPhase, IngestStatus } from '@myrddraall/heroprotocol-db/ingest';
import type { PickedReplay } from '@myrddraall/heroes-replay-stats-platform/model';

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
  /**
   * The database write in flight: `waiting` while another import holds the tables,
   * `writing` with rows added so far. Null when nothing is being written.
   */
  readonly store: StoreWrite | null;
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

/** Where a database write is; heroprotocol-db ≥ 0.5 reports it on the status snapshot. */
export interface StoreWrite {
  readonly state: 'waiting' | 'writing';
  readonly current: number;
  readonly total: number;
}

/** The snapshot's store write, if the worker reports one (older versions do not). */
export function storeOf(s: IngestStatus): StoreWrite | null {
  return (s as IngestStatus & { store?: StoreWrite }).store ?? null;
}

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
  } else if (s.phase === 'writing') {
    const w = storeOf(s);
    fraction = w && w.state === 'writing' && w.total > 0 ? w.current / w.total : 0;
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
