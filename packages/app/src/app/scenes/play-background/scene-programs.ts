/** `KHR_parallel_shader_compile`'s query: whether a program has finished compiling and linking. */
const COMPLETION_STATUS_KHR = 0x91b1;

/**
 * Where each vertex attribute is, in every program (bound before linking): a VAO then serves any
 * program drawn with it.
 */
export const ATTRIBUTES: Readonly<Record<string, number>> = {
  aPosition: 0,
  aUv: 1,
  aUv2: 2,
  aNormal: 3,
  aColor: 4,
  aCorner: 0,
  aParticle: 1,
  aParticleColor: 2,
  aTube: 0,
};

/** A program compiling (its shaders kept to report their errors once it is done). */
interface Compiling {
  readonly program: WebGLProgram;
  readonly shaders: readonly WebGLShader[];
}

/** Each context's programs, compiled at once, and in the background (see `programsOf`). */
const atOnce = new WeakMap<WebGL2RenderingContext, Programs>();
const inBackground = new WeakMap<WebGL2RenderingContext, Programs>();

/**
 * A context's programs, kept as long as it is: each renderer drawing into it (a scene loaded)
 * draws with those the one before compiled. With Direct3D (ANGLE) a program's first draw into a
 * target with two outputs (colour and glow) compiles it again, uncached, holding the whole
 * browser up a second or more; kept, a program pays that once, not with each scene.
 */
export function programsOf(gl: WebGL2RenderingContext, background = true): Programs {
  const kept = background ? inBackground : atOnce;
  let programs = kept.get(gl);
  if (!programs) kept.set(gl, (programs = new Programs(gl, background)));
  return programs;
}

/**
 * A program from its shaders' sources, compiled and linked now (or the one the context has from
 * them), its errors thrown (the browser waits for it).
 */
export function program(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram {
  const programs = programsOf(gl, false);
  const key = `${vertex}\n${fragment}`;
  programs.request(key, vertex, fragment);
  return programs.get(key)!;
}

/**
 * Programs by key, compiled when first asked for. Where the browser compiles in the background
 * (`KHR_parallel_shader_compile`), asking doesn't wait: `get` gives none until it is done (a draw
 * that needs it waits a frame or so); elsewhere it is compiled at once. A program that fails
 * throws its log when got.
 */
export class Programs {
  private readonly compiling = new Map<string, Compiling>();
  private readonly ready = new Map<string, WebGLProgram>();
  private readonly parallel: boolean;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    /** Whether to compile in the background where the browser can (false: always at once). */
    background = true,
  ) {
    this.parallel = background && gl.getExtension('KHR_parallel_shader_compile') !== null;
  }

  /** A program compiled from these sources under this key, if it isn't already. */
  request(key: string, vertex: string, fragment: string): void {
    if (this.ready.has(key) || this.compiling.has(key)) return;
    const gl = this.gl;
    const p = gl.createProgram();
    const shaders = (
      [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const
    ).map(([type, source]) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      gl.attachShader(p, s);
      return s;
    });
    for (const [name, at] of Object.entries(ATTRIBUTES)) gl.bindAttribLocation(p, at, name);
    gl.linkProgram(p);
    this.compiling.set(key, { program: p, shaders });
    if (!this.parallel) this.finish(key);
  }

  /** The program under a key, once compiled (none while it still is, or never asked for). */
  get(key: string): WebGLProgram | null {
    const done = this.ready.get(key);
    if (done) return done;
    const c = this.compiling.get(key);
    if (!c) return null;
    if (this.parallel && !this.gl.getProgramParameter(c.program, COMPLETION_STATUS_KHR))
      return null;
    return this.finish(key);
  }

  private finish(key: string): WebGLProgram {
    const gl = this.gl;
    const { program: p, shaders } = this.compiling.get(key)!;
    this.compiling.delete(key);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log =
        shaders.map((s) => gl.getShaderInfoLog(s)).find((l) => l) ??
        gl.getProgramInfoLog(p) ??
        'program';
      throw new Error(log);
    }
    for (const s of shaders) {
      gl.detachShader(p, s);
      gl.deleteShader(s);
    }
    this.ready.set(key, p);
    return p;
  }
}
