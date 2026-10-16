import { describe, expect, it } from 'vitest';
import type { SceneMesh, SceneParticles } from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';

/** A square emitter in the z = 10 plane, fully opaque on one corner and transparent on the others. */
const emitter: SceneMesh = {
  positions: [0, 0, 10, 4, 0, 10, 4, 4, 10, 0, 4, 10],
  uvs: [0, 0, 1, 0, 1, 1, 0, 1],
  colors: [255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0],
  indices: [0, 1, 2, 0, 2, 3],
  materials: [],
};

const system: SceneParticles = {
  emitter: 'square',
  material: 'stars',
  rate: 100,
  max: 500,
  lifespan: [2, 2],
  speed: [0, 0],
  sizes: [
    [0.1, 0.6, 0.1],
    [0.1, 1, 0.1],
  ],
  colors: [
    [
      [255, 0, 0, 0],
      [255, 0, 0, 255],
      [255, 0, 0, 0],
    ],
    [
      [0, 0, 255, 0],
      [0, 0, 255, 255],
      [0, 0, 255, 0],
    ],
  ],
  sizeMiddle: 0.5,
  sizeHold: 0,
  colorMiddle: 0.5,
  colorHold: 0,
  alphaMiddle: 0.5,
  alphaHold: 0,
  vertexAlpha: false,
};

/** A repeatable random sequence. */
function seeded(seed = 1): () => number {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('ParticleSystem', () => {
  it('starts as if it had been running: a steady state of particles part way through their lives', () => {
    const particles = new ParticleSystem(system, emitter, seeded());
    particles.update(0);
    expect(particles.count).toBe(200); // 100 a second, living 2 seconds
    for (let i = 0; i < particles.count; i++) {
      const p = particles.instances.subarray(i * INSTANCE_FLOATS, (i + 1) * INSTANCE_FLOATS);
      expect(p[2]).toBeCloseTo(10); // on the emitter
      expect(p[0]).toBeGreaterThanOrEqual(0);
      expect(p[0]).toBeLessThanOrEqual(4);
      expect(p[3]).toBeGreaterThanOrEqual(0.1); // between its sizes
      expect(p[3]).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the steady state as particles die and are born', () => {
    const particles = new ParticleSystem(system, emitter, seeded());
    for (let t = 0; t <= 10; t += 1 / 60) particles.update(t);
    expect(particles.count).toBeGreaterThan(180);
    expect(particles.count).toBeLessThan(220);
  });

  it('is in its steady state again after a jump longer than any life, not all born at once', () => {
    const particles = new ParticleSystem(system, emitter, seeded());
    particles.update(0);
    particles.update(600); // drawn again ten minutes on
    expect(particles.count).toBe(200);
    const sizes = Array.from({ length: particles.count }, (_, i) => particles.instances[i * INSTANCE_FLOATS + 3]!);
    expect(new Set(sizes.map((s) => s.toFixed(2))).size).toBeGreaterThan(20); // part way through their lives
  });

  it("scales each particle's alpha by the emitter's vertex alpha where it was born, where asked", () => {
    const faded = new ParticleSystem({ ...system, vertexAlpha: true }, emitter, seeded());
    const plain = new ParticleSystem(system, emitter, seeded());
    faded.update(0);
    plain.update(0);
    let sumFaded = 0,
      sumPlain = 0;
    for (let i = 0; i < plain.count; i++) {
      sumFaded += faded.instances[i * INSTANCE_FLOATS + 7]!;
      sumPlain += plain.instances[i * INSTANCE_FLOATS + 7]!;
    }
    expect(sumFaded).toBeLessThan(sumPlain * 0.5);
  });
});
