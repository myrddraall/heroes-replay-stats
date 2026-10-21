/** How a uniform's value is given to GL: its `gl.uniform*` call. */
export type UniformKind =
  '1i' | '1f' | '2f' | '3f' | '4f' | '1fv' | '1iv' | '3fv' | '4fv' | 'm3' | 'm4';

/** A uniform's value as set: its kind and its numbers. */
export interface UniformValue {
  readonly kind: UniformKind;
  readonly value: Float32Array | Int32Array;
}

/**
 * Uniforms' values set by name, without GL: what a draw sets, worked out once (when what it is
 * drawn as changes, not every frame), then given to GL each time it is drawn (`UniformBlock`).
 * A name set again keeps its last value.
 */
export class UniformSet {
  readonly values = new Map<string, UniformValue>();

  private put(name: string, kind: UniformKind, value: Float32Array | Int32Array): this {
    this.values.set(name, { kind, value });
    return this;
  }

  i1(name: string, x: number): this {
    return this.put(name, '1i', Int32Array.of(x));
  }
  /** An array of ints. */
  iv(name: string, values: ArrayLike<number>): this {
    return this.put(name, '1iv', Int32Array.from(values));
  }
  f1(name: string, x: number): this {
    return this.put(name, '1f', Float32Array.of(x));
  }
  f2(name: string, x: number, y: number): this {
    return this.put(name, '2f', Float32Array.of(x, y));
  }
  f3(name: string, x: number, y: number, z: number): this {
    return this.put(name, '3f', Float32Array.of(x, y, z));
  }
  f4(name: string, x: number, y: number, z: number, w: number): this {
    return this.put(name, '4f', Float32Array.of(x, y, z, w));
  }
  /** An array of floats (or a vec2/vec3/vec4 given as one, by `kind`). */
  fv(name: string, values: ArrayLike<number>, kind: '1fv' | '3fv' | '4fv' = '1fv'): this {
    return this.put(name, kind, Float32Array.from(values));
  }
  v2(name: string, v: ArrayLike<number>): this {
    return this.f2(name, v[0]!, v[1]!);
  }
  v3(name: string, v: ArrayLike<number>): this {
    return this.f3(name, v[0]!, v[1]!, v[2]!);
  }
  m3(name: string, m: ArrayLike<number>): this {
    return this.put(name, 'm3', Float32Array.from(m));
  }
  m4(name: string, m: ArrayLike<number>): this {
    return this.put(name, 'm4', Float32Array.from(m));
  }
  /** Another set's values over these. */
  merge(other: UniformSet): this {
    for (const [name, value] of other.values) this.values.set(name, value);
    return this;
  }
}

/** One uniform of a block: where it is in its program, and what it is set to. */
interface BlockEntry {
  readonly at: WebGLUniformLocation;
  readonly kind: UniformKind;
  readonly value: Float32Array | Int32Array;
}

/** A set's values for one program: those the program has (by location), ready to give to GL. */
export type UniformBlock = readonly BlockEntry[];

/**
 * A set's values as a program takes them: each name's location found once (one the program
 * doesn't use, as the compiler leaves it out, is dropped).
 */
export function compileBlock(
  set: UniformSet,
  locate: (name: string) => WebGLUniformLocation | null,
): UniformBlock {
  const out: BlockEntry[] = [];
  for (const [name, { kind, value }] of set.values) {
    const at = locate(name);
    if (at) out.push({ at, kind, value });
  }
  return out;
}

/** A block's values given to GL (its program in use). */
export function applyBlock(gl: WebGL2RenderingContext, block: UniformBlock): void {
  for (const { at, kind, value } of block) applyValue(gl, at, kind, value);
}

/** One value given to GL. */
export function applyValue(
  gl: WebGL2RenderingContext,
  at: WebGLUniformLocation,
  kind: UniformKind,
  value: Float32Array | Int32Array,
): void {
  switch (kind) {
    case '1i':
    case '1iv':
      gl.uniform1iv(at, value as Int32Array);
      return;
    case '1f':
    case '1fv':
      gl.uniform1fv(at, value as Float32Array);
      return;
    case '2f':
      gl.uniform2fv(at, value as Float32Array);
      return;
    case '3f':
    case '3fv':
      gl.uniform3fv(at, value as Float32Array);
      return;
    case '4f':
    case '4fv':
      gl.uniform4fv(at, value as Float32Array);
      return;
    case 'm3':
      gl.uniformMatrix3fv(at, false, value as Float32Array);
      return;
    case 'm4':
      gl.uniformMatrix4fv(at, false, value as Float32Array);
      return;
  }
}
