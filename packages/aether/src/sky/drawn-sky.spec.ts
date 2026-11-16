import { describe, expect, it } from 'vitest';
import type { PlayScene, SceneMaterial, SkyOverlayFile } from '../formats/play-scene';
import { drawnSky } from './drawn-sky';

const material = { blend: 'add', alphaMasks: [] } as unknown as SceneMaterial;
const overlay = (name: string): SkyOverlayFile => ({
  parts: [],
  materials: { [name]: material },
  textures: {},
});
const scene = {
  overlays: { nebula: overlay('glow'), streams: overlay('dust') },
  wears: ['nebula'],
} as unknown as PlayScene;

describe('the sky as drawn', () => {
  it('wears its scene’s overlays unless its settings name others, its own parts first', () => {
    expect(drawnSky({}, scene).worn.map((w) => w.id)).toEqual(['nebula']);
    const own = { file: overlay('spark'), images: {} };
    expect(drawnSky({ overlays: ['streams'], own }, scene).worn.map((w) => w.id)).toEqual([
      '',
      'streams',
    ]);
  });

  it('gives an overlay’s material its own settings over the sky’s base for it', () => {
    const sky = drawnSky(
      {
        materials: { stars: { strength: 0.4 }, 'style:nebula:glow': { glow: 2 } },
        base: { glow: { strength: 0.5, glow: 1 } },
      },
      scene,
    );
    expect(sky.materials).toEqual({
      stars: { strength: 0.4 },
      'style:nebula:glow': { strength: 0.5, glow: 2 },
    });
  });
});
