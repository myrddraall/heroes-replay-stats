import { describe, expect, it } from 'vitest';
import type { AidDot, AidLine } from '@myrddraall/heroes-replay-stats-aether/aids';
import type { SceneCamera } from '@myrddraall/heroes-replay-stats-aether/formats';
import { markerAids, shownMarkers } from './marker-aids';
import type { SceneMarker } from './scene-markers';

// An eye at the origin looking along +y, z up.
const camera = {
  eye: [0, 0, 0],
  forward: [0, 1, 0],
  up: [0, 0, 1],
  fovY: 40,
  near: 0.1,
  far: 1000,
} as unknown as SceneCamera;
const colours = { edge: [1, 0, 1], selected: [0, 0, 1] } as const;
const marker = (m: Partial<SceneMarker> & Pick<SceneMarker, 'key' | 'kind'>): SceneMarker => ({
  id: m.key,
  label: m.key,
  icon: 'circle',
  at: [0, 10, 0],
  selected: false,
  ...m,
});
const dots = (aids: ReturnType<typeof markerAids>) =>
  aids.filter((a): a is AidDot => a.shape === 'dot');
const lines = (aids: ReturnType<typeof markerAids>) =>
  aids.filter((a): a is AidLine => a.shape === 'line');

describe("the markers' aids", () => {
  it('give each marker but a pole a dot, a body’s on its near side; hovered or selected, it opens and goes on top', () => {
    const markers = [
      marker({ key: 'body', kind: 'body', lift: 2 }),
      marker({ key: 'light', kind: 'light', at: [1, 10, 0] }),
      marker({ key: 'pole', kind: 'pole' }),
    ];
    const shut = dots(markerAids(markers, 'all', null, camera, 1, colours));
    expect(shut.map((d) => [d.lift, d.onTop])).toEqual([
      [2, false],
      [0, false],
    ]);
    const hovered = dots(markerAids(markers, 'all', 'light', camera, 1, colours));
    expect(hovered[1]!.onTop).toBe(true);
    expect(hovered[1]!.pixels).toBeGreaterThan(shut[1]!.pixels);
    expect(hovered[1]!.colour).toEqual(colours.edge);
    const selected = dots(
      markerAids([{ ...markers[0]!, selected: true }], 'all', null, camera, 1, colours),
    );
    expect(selected[0]).toMatchObject({ onTop: true, colour: colours.selected });
  });

  it('draw a light’s line selected, solid; what a camera sees dashed; none for a camera where the view is', () => {
    const light = marker({ key: 'light', kind: 'light', from: [0, 9, 0], at: [3, 9, 0] });
    expect(lines(markerAids([light], 'all', null, camera, 1, colours))).toEqual([]);
    const picked = lines(
      markerAids([{ ...light, selected: true }], 'all', null, camera, 1, colours),
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ from: [0, 9, 0], to: [3, 9, 0], dashed: false });
    const seen = { ...camera, eye: [0, -5, 0] } as unknown as SceneCamera;
    const away = marker({ key: 'cam', kind: 'camera', at: [0, 5, 0], camera: seen, outline: 4 });
    const outline = lines(markerAids([away], 'all', null, camera, 1, colours));
    expect(outline.length).toBeGreaterThan(0);
    expect(outline.every((l) => l.dashed)).toBe(true);
    const here = marker({ key: 'cam', kind: 'camera', at: [0, 0, 0], camera });
    expect(markerAids([here], 'all', null, camera, 1, colours)).toEqual([]);
  });

  it('in the selected mode, keep only the selected thing’s (a light’s own, else the lights)', () => {
    const all = [
      marker({ key: 'a', kind: 'light' }),
      marker({ key: 'b', kind: 'light' }),
      marker({ key: 'p', kind: 'body' }),
    ];
    expect(shownMarkers(all, 'selected').map((m) => m.key)).toEqual(['a', 'b']);
    const one = all.map((m) => (m.key === 'b' ? { ...m, selected: true } : m));
    expect(shownMarkers(one, 'selected').map((m) => m.key)).toEqual(['b']);
  });
});
