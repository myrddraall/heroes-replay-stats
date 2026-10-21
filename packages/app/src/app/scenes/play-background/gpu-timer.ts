/** `EXT_disjoint_timer_query_webgl2`'s enums. */
const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;

/**
 * How long the GPU takes over what is drawn between `begin` and `end`, where the browser can tell
 * (`EXT_disjoint_timer_query_webgl2`; none elsewhere): read back a frame or two later, when the
 * GPU has done it, through `poll`. A time the GPU couldn't measure cleanly (disjoint) is dropped.
 */
export class GpuTimer {
  private readonly ext: object | null;
  private readonly pending: WebGLQuery[] = [];
  private running: WebGLQuery | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  /** Whether the browser can time the GPU. */
  get available(): boolean {
    return this.ext !== null;
  }

  begin(): void {
    if (!this.ext || this.running) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(TIME_ELAPSED_EXT, q);
    this.running = q;
  }

  end(): void {
    if (!this.running) return;
    this.gl.endQuery(TIME_ELAPSED_EXT);
    this.pending.push(this.running);
    this.running = null;
  }

  /** The times measured since last asked, in ms, oldest first. */
  poll(): number[] {
    const gl = this.gl;
    const out: number[] = [];
    const disjoint = this.ext ? gl.getParameter(GPU_DISJOINT_EXT) : false;
    while (this.pending.length) {
      const q = this.pending[0]!;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    return out;
  }

  dispose(): void {
    for (const q of this.pending) this.gl.deleteQuery(q);
    this.pending.length = 0;
    if (this.running) this.gl.deleteQuery(this.running);
    this.running = null;
  }
}
