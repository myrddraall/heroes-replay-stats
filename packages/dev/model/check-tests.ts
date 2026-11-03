/** Which of three.js's backends the check draws with: WebGPU, WebGL 2, or both at once. */
export type CheckMode = 'webgpu' | 'webgl' | 'both';

/** Each backend's renderer as the check's tables and pictures name it. */
export const SLOT_LABELS = { webgpu: 'three.js on WebGPU', webgl: 'three.js on WebGL 2' } as const;

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
