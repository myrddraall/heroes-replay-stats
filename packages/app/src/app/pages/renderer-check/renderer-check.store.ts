import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { ViewStore } from "@myrddraall/heroes-replay-stats-aether";
import { coldShaders, type RendererFactory } from "@myrddraall/heroes-replay-stats-aether/render";
import type { CheckTable } from './check-table';
import { compare, type Difference } from './compare';
import {
  CompileTimeline,
  type PageCosts,
  type PipelineRecord,
  type ProgramRecord,
} from './compile-timeline';
import { type CheckMode, type CheckSlot, DualRenderer, SLOT_LABELS } from './dual-renderer';

/** One of the check's tests drawing the background: which of three.js's backends draw. */
export interface CheckTest {
  readonly id: string;
  readonly label: string;
  readonly mode: CheckMode;
  /**
   * A warm-up: each backend's first run in the page load (its JavaScript, and WebGPU, starting
   * cold, as on a first visit), so the tests after it all start alike.
   */
  readonly warmUp: boolean;
}

/** The tests drawing the background, run in this order. */
export const CHECK_TESTS: readonly CheckTest[] = [
  { id: 'warm-webgpu', label: `Warm-up: ${SLOT_LABELS.webgpu}`, mode: 'webgpu', warmUp: true },
  { id: 'warm-webgl', label: `Warm-up: ${SLOT_LABELS.webgl}`, mode: 'webgl', warmUp: true },
  { id: 'webgpu', label: SLOT_LABELS.webgpu, mode: 'webgpu', warmUp: false },
  { id: 'webgl', label: SLOT_LABELS.webgl, mode: 'webgl', warmUp: false },
  { id: 'both', label: 'Both at once, compared', mode: 'both', warmUp: false },
];

/** One renderer's times in a test, ms from when its renderers were made. */
interface RendererTimes {
  /** Which backend it was asked to draw with (`SLOT_LABELS`). */
  readonly renderer: string;
  /** What it drew with ('WebGPU', 'WebGL 2'): WebGL 2 where WebGPU was asked for but the browser hasn't it. */
  readonly backend: string | null;
  readonly first: number | null;
  readonly whole: number | null;
  readonly gpuDone: number | null;
}

/** How a test drawing the background went. */
export interface TestResult {
  readonly test: CheckTest;
  readonly outcome: 'done' | 'failed' | 'too long';
  readonly error: string | null;
  readonly times: readonly RendererTimes[];
  /** The picture's size (device pixels). */
  readonly width: number;
  readonly height: number;
  /** Where both drew: their pictures of one frame compared. */
  readonly difference: Difference | null;
  /** How long the page was hidden during it, after trying it again (ms; its times then not to be trusted). */
  readonly hiddenMs: number;
  /** Whether it is a second run (the first was hidden): a warm-up's is no longer the renderer's first. */
  readonly again: boolean;
  /** The programs compiled and pipelines made, their times from when the renderers were made. */
  readonly programs: readonly ProgramRecord[];
  readonly pipelines: readonly PipelineRecord[];
  readonly costs: PageCosts;
}

/** How long a test may take before it is given up. */
const TEST_LIMIT_MS = 5 * 60 * 1000;
/** A slot's times, as the tables show them. */
const timesOf = (renderer: string, s: CheckSlot): RendererTimes => ({
  renderer,
  backend: s.renderer.backendName,
  first: s.first,
  whole: s.whole,
  gpuDone: s.gpuDone,
});
/** The pause between steps, the GPU left idle, so no step's work runs into the next's. */
const PAUSE_MS = 3000;
/** How often a running test is looked at. */
const POLL_MS = 100;
/** How many times a test is run while the page was hidden during it. */
const TRIES = 2;
/** three.js's own pipelines for making mipmaps (not the scene's). */
const MIPMAP = /^mipmap-/;

/** A pipeline's name as three.js labels it, without its prefix and its material's number (`renderPipeline_body:opaque_12`). */
const pipelineName = (label: string) =>
  label.replace(/^renderPipeline_/, '').replace(/_\d+$/, '') || '(no label)';

interface CheckState {
  readonly phase: 'idle' | 'running' | 'done';
  /** What is running, said plainly. */
  readonly step: string | null;
  /** The background test running (its index), or null: its background is then taken down. */
  readonly current: number | null;
  /** Whether the background is up only to load the scene, untimed, before the tests: it draws nothing. */
  readonly warmingUp: boolean;
  readonly environment: readonly (readonly [string, string])[];
  readonly tests: readonly TestResult[];
  /** Steps that failed, and why (the run went on). */
  readonly failures: readonly (readonly [step: string, error: string])[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ms = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(Math.round(n));

/** What the computer is, as the browser tells (WebGPU's adapter asked for later: see `adapterRow`). */
function environment(): [string, string][] {
  const rows: [string, string][] = [
    ['Browser', navigator.userAgent],
    ['CPU threads', String(navigator.hardwareConcurrency)],
  ];
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    rows.push([
      'WebGL renderer',
      String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    ]);
    const has = (name: string) => (gl.getExtension(name) ? 'yes' : 'no');
    rows.push([
      'Parallel compiling (KHR_parallel_shader_compile)',
      has('KHR_parallel_shader_compile'),
    ]);
    rows.push(['Float targets (EXT_color_buffer_float)', has('EXT_color_buffer_float')]);
    rows.push(['Translated shaders shown (WEBGL_debug_shaders)', has('WEBGL_debug_shaders')]);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return rows;
}

/** WebGPU's adapter, as the browser tells (asked for after the tests, so none of them finds WebGPU started by it). */
async function adapterRow(): Promise<[string, string]> {
  const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
  const a = adapter?.info;
  return [
    'WebGPU adapter',
    a ? [a.vendor, a.architecture, a.device, a.description].filter(Boolean).join(' / ') : 'none',
  ];
}

/**
 * The renderer check (provided by its page): started, it runs its steps one at a time. First the
 * scene's files are loaded, untimed. Then the tests drawing the site's background with three.js,
 * on WebGPU and on WebGL 2 (each with its own renderers, every shader compiled cold: each test's
 * are unique to it, `coldShaders`), each until every planet is drawn and the GPU has done it,
 * every program compiled and pipeline made timed along the way (`CompileTimeline`); each backend's
 * first run is a warm-up, so the tests after start alike; where both draw, their pictures are then
 * compared (the two backends should draw the same picture). Every test starts at the same set of
 * planets. A step during which the page was hidden (nothing drawn, timers slowed) is run again; a
 * step that fails is noted and the rest still run. The results are tables.
 */
export const RendererCheckStore = signalStore(
  withState<CheckState>({
    phase: 'idle',
    step: null,
    current: null,
    warmingUp: false,
    environment: [],
    tests: [],
    failures: [],
  }),
  withProps(() => ({
    background: inject(ViewStore),
    /** The canvas three.js on WebGPU draws into where both draw, shown beside the background's. */
    canvas: document.createElement('canvas'),
    _run: {
      /** The run going on (a new number each start: a run left behind does nothing more). */
      id: 0,
      stopped: false,
      timeline: null as CompileTimeline | null,
      uninstall: null as (() => void) | null,
      dual: null as DualRenderer | null,
      /** The running test's nonce (cleared only while it is still the one set). */
      nonce: null as number | null,
      planetSet: 0,
      /** Why the running test's renderers couldn't be made, if they couldn't. */
      error: null as string | null,
      /** Whether the scene has loaded in the untimed warm-up. */
      warmedUp: false,
      /** When the page was hidden (to: null while it still is). */
      hidden: [] as { from: number; to: number | null }[],
      wakeLock: null as WakeLockSentinel | null,
    },
  })),
  withComputed(({ current }) => ({
    test: computed(() => {
      const i = current();
      return i === null ? null : CHECK_TESTS[i]!;
    }),
  })),
  withProps((store) => ({
    /** What the running test's background draws with: its renderers, cold. */
    factory: ((canvas, loaded) => {
      const run = store._run;
      if (store.warmingUp()) {
        // The scene loaded (its files now in the browser's cache, as every test would find them): nothing drawn.
        run.warmedUp = true;
        throw new Error('the renderer check loads the scene before its tests');
      }
      const test = store.test();
      if (!test) throw new Error('no test is running');
      run.dual?.dispose();
      const nonce = 1 + Math.random() * 1e6;
      run.nonce = nonce;
      coldShaders.nonce = nonce;
      try {
        run.dual = new DualRenderer(canvas, loaded, store.canvas, test.mode);
      } catch (e) {
        run.error = message(e);
        throw e;
      }
      return run.dual;
    }) satisfies RendererFactory,
  })),
  withComputed((store) => ({
    /** Every result, as tables. */
    tables: computed((): CheckTable[] => {
      const tables: CheckTable[] = [];
      if (store.failures().length)
        tables.push({
          title: 'Steps that failed (the others still ran)',
          columns: ['Step', 'Why'],
          rows: store.failures(),
        });
      if (store.environment().length)
        tables.push({
          title: 'This computer',
          columns: ['What', 'Here'],
          rows: store.environment(),
        });
      const tests = store.tests();
      if (tests.length) {
        tables.push({
          title: 'Tests drawing the background (ms from when its renderers were made)',
          columns: [
            'Test',
            'Renderer',
            'First frame',
            'Whole picture',
            'GPU done',
            'Picture size',
            'Outcome',
          ],
          rows: tests.flatMap((t) =>
            (t.times.length
              ? t.times
              : [{ renderer: '', backend: null, first: null, whole: null, gpuDone: null }]
            ).map((r) => [
              t.test.label,
              // What it drew with, where that isn't what was asked for (no WebGPU in the browser).
              r.backend && !r.renderer.endsWith(r.backend)
                ? `${r.renderer} (drew with ${r.backend})`
                : r.renderer,
              ms(r.first),
              ms(r.whole),
              ms(r.gpuDone),
              t.width ? `${t.width} x ${t.height}` : '',
              [
                t.again && t.test.warmUp
                  ? 'run again (the page was hidden): not the first run in the page'
                  : '',
                t.hiddenMs > 0
                  ? `page hidden ${Math.round(t.hiddenMs / 1000)} s: times not to be trusted`
                  : '',
                t.outcome === 'failed'
                  ? `failed: ${t.error ?? ''}`
                  : t.outcome === 'too long'
                    ? 'not done in 5 minutes'
                    : '',
              ]
                .filter(Boolean)
                .join('; '),
            ]),
          ),
        });
        tables.push({
          title: "Each test's costs",
          columns: [
            'Test',
            'Getting contexts (ms)',
            'WebGPU start (ms)',
            'Waiting on links (ms)',
            'Texture uploads (ms)',
            'Long tasks',
            'Longest task (ms)',
            'WebGPU pipelines made ahead',
            'Longest made ahead (ms)',
            'WebGPU pipelines made at first draw',
            'three.js mipmap pipelines',
          ],
          rows: tests.map((t) => {
            const ahead = t.pipelines.filter((p) => p.kind === 'async');
            const atFirstDraw = t.pipelines.filter((p) => p.kind === 'sync');
            return [
              t.test.label,
              ms(t.costs.getContextMs),
              ms(t.costs.gpuStartMs),
              t.programs.length ? ms(t.programs.reduce((sum, p) => sum + p.syncWaitMs, 0)) : '',
              ms(t.costs.textureUploadMs),
              String(t.costs.longTasks),
              ms(t.costs.longestTaskMs),
              String(ahead.length),
              ms(Math.max(0, ...ahead.map((p) => (p.resolvedAt ?? p.requestedAt) - p.requestedAt))),
              String(atFirstDraw.filter((p) => !MIPMAP.test(p.label)).length),
              String(atFirstDraw.filter((p) => MIPMAP.test(p.label)).length),
            ];
          }),
        });
        const compared = tests.filter((t) => t.difference);
        if (compared.length)
          tables.push({
            title: 'Pictures compared',
            columns: [
              'Test',
              'Pixels over 2 levels',
              'Pixels over 8 levels',
              'Largest difference',
              'Mean difference',
              'Picture size',
            ],
            rows: compared.map((t) => {
              const d = t.difference!;
              return [
                t.test.label,
                `${(d.over2 * 100).toFixed(2)}%`,
                `${(d.over8 * 100).toFixed(2)}%`,
                String(d.largest),
                d.mean.toFixed(3),
                `${t.width} x ${t.height}`,
              ];
            }),
          });
        const programs = tests.flatMap((t) => t.programs.map((p) => [t.test.label, p] as const));
        if (programs.length)
          tables.push({
            title: 'WebGL programs compiled in each test (ms from when its renderers were made)',
            columns: [
              'Test',
              'Program',
              'Fragment lines',
              'Asked at',
              'Link call',
              'Done at',
              'Compiling',
              'Waited on',
              'First draw at',
              'First draw done',
              'Translated vertex shader (bytes)',
              'Translated fragment shader (bytes)',
              'Log',
            ],
            rows: programs.map(([test, p]) => [
              test,
              `Program ${p.id}`,
              String(p.fragmentLines),
              ms(p.requestedAt),
              ms(p.linkCallMs),
              ms(p.completedAt),
              p.completedAt === null ? '' : ms(p.completedAt - p.requestedAt),
              ms(p.syncWaitMs),
              ms(p.firstDrawAt),
              ms(p.firstDrawDoneAt),
              p.translatedVertexBytes === null ? '' : String(p.translatedVertexBytes),
              p.translatedFragmentBytes === null ? '' : String(p.translatedFragmentBytes),
              p.flags.join(' '),
            ]),
          });
        const ahead = tests.flatMap((t) => {
          const first = t.times.find((r) => r.renderer === SLOT_LABELS.webgpu)?.first ?? null;
          return t.pipelines
            .filter((p) => p.kind === 'async')
            .map((p) => [t.test.label, p, first] as const);
        });
        if (ahead.length)
          tables.push({
            title:
              'WebGPU pipelines made ahead in each test (ms from when its renderers were made)',
            columns: [
              'Test',
              'Pipeline',
              'Asked at',
              'Done at',
              'Building',
              'Done before the first frame',
              'Shader code (bytes)',
            ],
            rows: ahead.map(([test, p, first]) => [
              test,
              pipelineName(p.label),
              ms(p.requestedAt),
              ms(p.resolvedAt),
              p.resolvedAt === null ? '' : ms(p.resolvedAt - p.requestedAt),
              p.resolvedAt !== null && first !== null && p.resolvedAt <= first ? 'yes' : '',
              String(p.codeBytes),
            ]),
          });
        const atFirstDraw = tests.flatMap((t) =>
          t.pipelines.filter((p) => p.kind === 'sync').map((p) => [t.test.label, p] as const),
        );
        if (atFirstDraw.length)
          tables.push({
            title:
              'WebGPU pipelines made at their first draw, not ahead (ms from when its renderers were made)',
            columns: ['Test', 'Pipeline', 'Made at', 'Built in (at most)', 'Shader code (bytes)'],
            rows: atFirstDraw.map(([test, p]) => [
              test,
              pipelineName(p.label),
              ms(p.requestedAt),
              p.resolvedAt === null ? '' : ms(p.resolvedAt - p.requestedAt),
              String(p.codeBytes),
            ]),
          });
      }
      return tables;
    }),
    /** The last comparison's difference, to show. */
    difference: computed(() => {
      const t = [...store.tests()].reverse().find((r) => r.difference);
      return t ? { image: t.difference!.image, width: t.width, height: t.height } : null;
    }),
  })),
  withMethods((store) => {
    const run = store._run;
    const fail = (step: string, e: unknown) =>
      patchState(store, { failures: [...store.failures(), [step, message(e)] as const] });
    /** How long the page was hidden between two times (`performance.now`). */
    const hiddenBetween = (from: number, to: number) =>
      run.hidden.reduce(
        (sum, h) =>
          sum + Math.max(0, Math.min(to, h.to ?? performance.now()) - Math.max(from, h.from)),
        0,
      );
    const onVisibility = () => {
      const now = performance.now();
      if (document.hidden) run.hidden.push({ from: now, to: null });
      else {
        const open = run.hidden.at(-1);
        if (open && open.to === null) open.to = now;
        void keepAwake(); // a lock is let go when the page is hidden: taken again
      }
    };
    /** The screen kept on while the check runs (a display turned off or locked hides the page). */
    const keepAwake = async () => {
      try {
        run.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        run.wakeLock = null; // not allowed here: the check runs without it
      }
    };
    const stopTest = () => {
      run.dual = null; // its background, taken down, disposes it
      if (coldShaders.nonce === run.nonce) coldShaders.nonce = null;
      run.nonce = null;
    };
    /** The running test, once over: its result (null while it isn't). */
    const outcome = async (test: CheckTest, started: number): Promise<TestResult | null> => {
      const timeline = run.timeline!;
      const dual = run.dual;
      const result = (outcome: TestResult['outcome'], error: string | null): TestResult => {
        const taken = timeline.take();
        // The timeline's times, made relative to when the renderers were made.
        const origin = dual ? timeline.fromPerformance(dual.made) : 0;
        const at = (t: number | null) => (t === null ? null : t - origin);
        const times: RendererTimes[] = [];
        if (dual?.webgpu) times.push(timesOf(SLOT_LABELS.webgpu, dual.webgpu));
        if (dual?.webgl) times.push(timesOf(SLOT_LABELS.webgl, dual.webgl));
        const size = dual?.size ?? { width: 0, height: 0 };
        return {
          test,
          outcome,
          error,
          times,
          width: size.width,
          height: size.height,
          difference: null,
          hiddenMs: hiddenBetween(started, performance.now()),
          again: false,
          programs: taken.programs.map((p) => ({
            ...p,
            requestedAt: p.requestedAt - origin,
            completedAt: at(p.completedAt),
            firstDrawAt: at(p.firstDrawAt),
            firstDrawDoneAt: at(p.firstDrawDoneAt),
            flags: [...p.flags],
          })),
          pipelines: taken.pipelines.map((p) => ({
            ...p,
            requestedAt: p.requestedAt - origin,
            resolvedAt: at(p.resolvedAt),
          })),
          costs: { ...taken.costs },
        };
      };
      if (performance.now() - started > TEST_LIMIT_MS) return result('too long', null);
      if (run.error) return result('failed', run.error);
      const failed = dual?.failedWith;
      if (failed) return result('failed', failed);
      if (!dual || dual.settling) return null;
      if (dual.webgpu && dual.webgpu.gpuDone === null) return null;
      if (dual.webgl && dual.webgl.gpuDone === null) return null;
      if (test.mode !== 'both') return result('done', null);
      if (!dual.bothDrew || !dual.webgpu || !dual.webgl) return null;
      // Taken before the read-back: its own draws (and pipelines) aren't the test's.
      const done = result('done', null);
      dual.holding = true;
      try {
        const webgpu = await dual.webgpu.renderer.readPixels();
        const webgl = await dual.webgl.renderer.readPixels();
        if (webgpu.length !== webgl.length)
          return {
            ...done,
            outcome: 'failed',
            error: `the pictures' sizes differ (${webgpu.length} and ${webgl.length} bytes)`,
          };
        return { ...done, difference: compare(webgpu, webgl, done.width, done.height) };
      } catch (e) {
        return {
          ...done,
          outcome: 'failed',
          error: `reading the pictures back failed: ${message(e)}`,
        };
      } finally {
        dual.holding = false;
      }
    };
    /** One test, run again if the page was hidden during it (with a fresh nonce: still cold). */
    const runTest = async (index: number) => {
      const test = CHECK_TESTS[index]!;
      for (let attempt = 1; attempt <= TRIES && !run.stopped; attempt++) {
        run.error = null;
        store.background.setPlanetSet(run.planetSet);
        run.timeline!.take(); // what came before isn't this test's
        const started = performance.now();
        patchState(store, {
          current: index,
          step: attempt > 1 ? `${test.label} (again: the page was hidden)` : test.label,
        });
        let result: TestResult | null = null;
        try {
          while (!result && !run.stopped) {
            await wait(POLL_MS);
            result = await outcome(test, started);
          }
        } catch (e) {
          fail(test.label, e);
        }
        stopTest();
        patchState(store, { current: null, step: 'The next step, shortly' });
        if (result && (result.hiddenMs === 0 || attempt === TRIES))
          patchState(store, { tests: [...store.tests(), { ...result, again: attempt > 1 }] });
        await wait(PAUSE_MS);
        if (!result || result.hiddenMs === 0) return;
      }
    };
    /** The scene loaded once, untimed, so every test finds its files alike. Whether it loaded. */
    const loadScene = async (): Promise<boolean> => {
      run.warmedUp = false;
      patchState(store, { warmingUp: true, step: "Loading the scene's files" });
      const started = performance.now();
      while (!run.warmedUp && !run.stopped && performance.now() - started < TEST_LIMIT_MS)
        await wait(POLL_MS);
      patchState(store, { warmingUp: false, step: 'The next step, shortly' });
      if (!run.warmedUp && !run.stopped)
        fail("Loading the scene's files", 'they did not load in 5 minutes');
      await wait(PAUSE_MS);
      return run.warmedUp;
    };
    /** Everything the run set up, let go of. */
    const finish = () => {
      stopTest();
      run.uninstall?.();
      run.uninstall = null;
      run.timeline = null;
      document.removeEventListener('visibilitychange', onVisibility);
      void run.wakeLock?.release().catch(() => undefined);
      run.wakeLock = null;
    };
    return {
      /** Every step, one at a time, from the first; the results so far cleared. */
      async start(): Promise<void> {
        if (store.phase() === 'running') return;
        const id = ++run.id;
        run.stopped = false;
        run.planetSet = store.background.planetSet();
        run.hidden = document.hidden ? [{ from: performance.now(), to: null }] : [];
        document.addEventListener('visibilitychange', onVisibility);
        void keepAwake();
        patchState(store, {
          phase: 'running',
          step: 'This computer',
          environment: environment(),
          tests: [],
          failures: [],
        });
        run.timeline = new CompileTimeline();
        run.uninstall = run.timeline.install();
        try {
          if (await loadScene())
            for (let i = 0; i < CHECK_TESTS.length && !run.stopped; i++) await runTest(i);
          if (!run.stopped) {
            try {
              patchState(store, { environment: [...store.environment(), await adapterRow()] });
            } catch (e) {
              fail('WebGPU adapter', e);
            }
          }
        } catch (e) {
          fail(store.step() ?? 'The check', e);
        } finally {
          // A run left behind (the page left, or started again) has already let go of everything.
          if (run.id === id && !run.stopped) {
            finish();
            patchState(store, { phase: 'done', step: null, current: null });
          }
        }
      },
      dispose(): void {
        run.stopped = true;
        finish();
      },
    };
  }),
  withHooks({
    onDestroy(store) {
      store.dispose();
    },
  }),
);
