import { describe, expect, it } from 'vitest';
import { portraitSource, type PortraitSource } from './portrait';

const minimap: PortraitSource = {
  picture: { src: 'minimap.webp', rect: [0, 0, 32, 32] },
  scale: 32 / 26,
};
const art: PortraitSource = {
  picture: {
    src: 'target.webp',
    rect: [0, 0, 92, 93],
    variants: [{ src: 'target-small.webp', rect: [0, 0, 64, 64] }],
  },
};

describe('portraitSource', () => {
  it('shows the first source whose art covers the size drawn, in order of preference', () => {
    // the minimap icon's art is 26 across
    expect(portraitSource([minimap, art], 24)).toBe(minimap);
    expect(portraitSource([minimap, art], 26)).toBe(minimap);
    expect(portraitSource([minimap, art], 40)).toBe(art);
  });

  it('shows the biggest where none covers it, and the first until it is measured', () => {
    expect(portraitSource([minimap, art], 200)).toBe(art);
    expect(portraitSource([minimap, art], null)).toBe(minimap);
    expect(portraitSource([art], 10)).toBe(art);
    expect(portraitSource([], 10)).toBeNull();
  });
});
