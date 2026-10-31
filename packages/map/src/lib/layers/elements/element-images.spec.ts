import { describe, expect, it } from 'vitest';
import { ElementImages } from './element-images';
import type { MapAssets } from '../../pack/map-assets';
import type { ElementCut, PackElements, PackTeamColours } from '../../pack/map-pack';

const atlas = (file: string, scale = 1) => ({ file, size: [64, 64] as const, scale });

const elements = {
  layer: 'map',
  atlases: {
    standing: atlas('standing.webp'),
    small: atlas('small.webp', 0.5),
    team: atlas('team.webp'),
    teamSmall: atlas('team-small.webp', 0.5),
  },
  structures: [],
  outposts: [],
  camps: [],
} as unknown as PackElements;

const cut: ElementCut = {
  rect: [0, 0, 8, 8],
  atlas: 'standing',
  at: [0, 0],
  small: [0, 0],
  teamMask: { at: [0, 0], small: [0, 0] },
};

const colours = {
  shot: { order: [101, 159, 255], chaos: [255, 57, 48], maskScale: 2 } as PackTeamColours,
  wanted: { order: [255, 57, 48], chaos: [101, 159, 255] } as const,
};

/** Assets whose pictures arrive (or fail) when the test says so, as stand-in bitmaps. */
function assets() {
  const pending = new Map<
    string,
    { resolve: (b: ImageBitmap) => void; reject: (e: unknown) => void }
  >();
  const fake: MapAssets = {
    tiles: () => ({ getZxy: async () => undefined }),
    picture: (file) =>
      new Promise<ImageBitmap>((resolve, reject) => pending.set(file, { resolve, reject })),
    text: async () => '',
    url: (file) => file,
  };
  const settle = async (file: string, ok = true) => {
    const p = pending.get(file)!;
    if (ok) p.resolve({ file, close: () => undefined } as unknown as ImageBitmap);
    else p.reject(new Error(`no ${file}`));
    await new Promise((r) => setTimeout(r));
  };
  return { fake, pending, settle };
}

describe('element pictures in other team colours', () => {
  it("waits at the full level for the mask's atlas, so the small picture is drawn meanwhile", async () => {
    const { fake, pending, settle } = assets();
    const images = new ElementImages(fake, elements, () => undefined);
    images.wantFull(false);
    await settle('standing.webp');
    // The full picture is there, its mask isn't: nothing yet (not the colours as shot), and the
    // mask's atlas is asked for.
    expect(images.picture(cut, [], 'full', colours)).toBeUndefined();
    expect(pending.has('team.webp')).toBe(true);
    // Without other colours the full picture is drawn at once.
    expect(images.picture(cut, [], 'full')?.source).toMatchObject({ file: 'standing.webp' });
  });

  it('draws the small picture as shot until its mask arrives: nothing coarser to draw', async () => {
    const { fake, pending, settle } = assets();
    const images = new ElementImages(fake, elements, () => undefined);
    await settle('small.webp');
    expect(images.picture(cut, [], 'small', colours)?.source).toMatchObject({ file: 'small.webp' });
    expect(pending.has('team-small.webp')).toBe(true);
  });

  it("draws the picture as shot when its mask's atlas can't be read", async () => {
    const { fake, settle } = assets();
    const images = new ElementImages(fake, elements, () => undefined);
    images.wantFull(false);
    await settle('standing.webp');
    images.picture(cut, [], 'full', colours);
    await settle('team.webp', false);
    expect(images.picture(cut, [], 'full', colours)?.source).toMatchObject({
      file: 'standing.webp',
    });
  });
});
