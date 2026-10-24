/** What a uniform's value is: an int, a float, a vector, an array, a matrix (named as GL's `uniform*` calls are). */
export type UniformKind =
  '1i' | '1f' | '2f' | '3f' | '4f' | '1fv' | '1iv' | '3fv' | '4fv' | 'm3' | 'm4';

/** A uniform's value as set: its kind and its numbers. */
export interface UniformValue {
  readonly kind: UniformKind;
  readonly value: Float32Array | Int32Array;
}

/**
 * Uniforms' values set by name: what a draw sets, worked out once (when what it is drawn as
 * changes, not every frame), then given to its shader each time it is drawn (three/shader-uniforms.ts,
 * `DrawValues.apply`). A name set again keeps its last value.
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
