import { type SceneMesh, type SceneParticles, threeKeys } from '../formats/play-scene';

/** Floats per particle in the instance buffer: position (3), size (1), colour (4). */
export const INSTANCE_FLOATS = 8;

/**
 * A particle system as the game's: born on the emitter mesh's triangles (by area) at `rate` a
 * second, each living its own lifespan through its own sizes and colours. A fixed pool of `max`
 * particles, filled at once as if it had been running (no empty sky at the start), so a frame
 * allocates nothing.
 */
export class ParticleSystem {
  /** Per particle: position (3), the emitter's alpha there (1), birth (1), lifespan (1), size and colour mix (2). */
  private readonly state: Float32Array;
  private readonly alive: Uint8Array;
  /** What `instances` holds for the alive ones, ready for the GPU. */
  readonly instances: Float32Array;
  count = 0;
  private readonly triangles: Float32Array;
  private readonly cumulativeArea: Float32Array;
  private carry = 0;
  private last: number | undefined;

  constructor(
    readonly system: SceneParticles,
    emitter: SceneMesh,
    private readonly random: () => number = Math.random,
  ) {
    this.state = new Float32Array(system.max * 8);
    this.alive = new Uint8Array(system.max);
    this.instances = new Float32Array(system.max * INSTANCE_FLOATS);
    // Each triangle as its three corners and their alphas: 12 floats.
    const tris = emitter.indices.length / 3;
    this.triangles = new Float32Array(tris * 12);
    this.cumulativeArea = new Float32Array(tris);
    let total = 0;
    for (let t = 0; t < tris; t++) {
      const corners = [0, 1, 2].map((k) => emitter.indices[t * 3 + k]!);
      corners.forEach((v, k) => {
        this.triangles.set(emitter.positions.slice(v * 3, v * 3 + 3), t * 12 + k * 4);
        this.triangles[t * 12 + k * 4 + 3] = emitter.colors[v * 4 + 3]! / 255;
      });
      const [ax, ay, az, , bx, by, bz, , cx, cy, cz] = this.triangles.subarray(t * 12, t * 12 + 12);
      const ux = bx! - ax!,
        uy = by! - ay!,
        uz = bz! - az!;
      const vx = cx! - ax!,
        vy = cy! - ay!,
        vz = cz! - az!;
      total += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      this.cumulativeArea[t] = total;
    }
  }

  /** Advance to `seconds` (the scene's clock) and fill `instances` with the particles alive. */
  update(seconds: number): void {
    const { rate, lifespan } = this.system;
    if (this.last === undefined || seconds - this.last >= lifespan[1]) {
      // As if it had been running: as many as a steady state holds, each part way through its life.
      // So too after a jump longer than any life (a background that doesn't move, drawn again):
      // every particle there was is gone.
      this.alive.fill(0);
      this.carry = 0;
      const steady = Math.min(
        this.system.max,
        Math.round((rate * (lifespan[0] + lifespan[1])) / 2),
      );
      for (let i = 0; i < steady; i++) this.spawn(seconds, this.random());
    } else {
      this.carry += Math.max(0, seconds - this.last) * rate;
      for (; this.carry >= 1; this.carry--) this.spawn(seconds, 0);
    }
    this.last = seconds;
    this.write(seconds);
  }

  /** A new particle born `through` (0-1) of its life ago. */
  private spawn(now: number, through: number): void {
    const slot = this.alive.indexOf(0);
    if (slot < 0) return;
    const { lifespan } = this.system;
    const life = lifespan[0] + (lifespan[1] - lifespan[0]) * this.random();
    const area = this.cumulativeArea[this.cumulativeArea.length - 1]! * this.random();
    let t = 0;
    while (t < this.cumulativeArea.length - 1 && this.cumulativeArea[t]! < area) t++;
    let u = this.random(),
      v = this.random();
    if (u + v > 1) [u, v] = [1 - u, 1 - v];
    const w = 1 - u - v;
    const tri = this.triangles.subarray(t * 12, t * 12 + 12);
    const s = this.state.subarray(slot * 8, slot * 8 + 8);
    for (let k = 0; k < 4; k++) s[k] = tri[k]! * w + tri[4 + k]! * u + tri[8 + k]! * v;
    s[4] = now - through * life;
    s[5] = life;
    s[6] = this.random();
    s[7] = this.random();
    this.alive[slot] = 1;
  }

  private write(now: number): void {
    const p = this.system;
    const [sizes1, sizes2] = p.sizes;
    const [colors1, colors2] = p.colors;
    let n = 0;
    for (let i = 0; i < p.max; i++) {
      if (!this.alive[i]) continue;
      const s = this.state.subarray(i * 8, i * 8 + 8);
      const t = (now - s[4]!) / s[5]!;
      if (t >= 1) {
        this.alive[i] = 0;
        continue;
      }
      const sizeMix = s[6]!,
        colorMix = s[7]!;
      const size = (k: number) => sizes1[k]! + (sizes2[k]! - sizes1[k]!) * sizeMix;
      const color = (key: number, c: number) =>
        colors1[key]![c]! + (colors2[key]![c]! - colors1[key]![c]!) * colorMix;
      const out = this.instances.subarray(
        n * INSTANCE_FLOATS,
        n * INSTANCE_FLOATS + INSTANCE_FLOATS,
      );
      out[0] = s[0]!;
      out[1] = s[1]!;
      out[2] = s[2]!;
      out[3] = threeKeys(size(0), size(1), size(2), p.sizeMiddle, p.sizeHold, t);
      for (let c = 0; c < 3; c++) {
        out[4 + c] =
          threeKeys(color(0, c), color(1, c), color(2, c), p.colorMiddle, p.colorHold, t) / 255;
      }
      const alpha =
        threeKeys(color(0, 3), color(1, 3), color(2, 3), p.alphaMiddle, p.alphaHold, t) / 255;
      out[7] = alpha * (p.vertexAlpha ? s[3]! : 1);
      n++;
    }
    this.count = n;
  }
}
