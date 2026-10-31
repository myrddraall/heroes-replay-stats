import { describe, expect, it } from 'vitest';
import {
  blackBody,
  gradingOf,
  keptColourTint,
  lightFirst,
  pictureTint,
  toneRange,
  whiteBalance,
} from './grading';
import type { TintLayer } from './tint-layers';

const wb: TintLayer = { id: 'wb', kind: 'white-balance', strength: 1, temperature: 5000, tint: 0 };
const fill: TintLayer = { id: 'f', kind: 'colour', strength: 1, colour: '#ff0000', blend: 'multiply' };
const theme: TintLayer = { id: 't', kind: 'theme', strength: 0.5, preset: 'gold' };

describe('a scene grading as drawn', () => {
  it('puts those on the light apart from those on the picture, those switched off left out', () => {
    const g = gradingOf({ tints: [fill, wb, theme], tintsEnabled: { f: false } }, () => null);
    expect(g.light).toEqual([wb]);
    expect(g.picture).toEqual([]);
  });

  it("draws a theme colour as a colour fill of the theme's colour, by its strength", () => {
    const g = gradingOf({ tints: [theme] }, (t) => pictureTint('#ffcc00', 'multiply', t.strength));
    expect(g.picture).toEqual([pictureTint('#ffcc00', 'multiply', 0.5)]);
  });

  it('keeps those on the light first, each side in its order', () => {
    expect(lightFirst([fill, wb, theme]).map((t) => t.id)).toEqual(['wb', 'f', 't']);
  });
});

describe('white balance', () => {
  it('is as it is at 6500 K with no tint', () => {
    whiteBalance(6500, 0).forEach((v) => expect(v).toBeCloseTo(1));
  });

  it('turns a warm light cooler (more blue than red), keeping its brightness', () => {
    const [r, g, b] = whiteBalance(3000, 0);
    expect(b).toBeGreaterThan(r);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(1);
  });

  it("reads a black body's colour warmer below 6500 K and bluer above", () => {
    expect(blackBody(3000)[2]).toBeLessThan(blackBody(3000)[0]);
    expect(blackBody(12000)[0]).toBeLessThan(blackBody(12000)[2]);
  });
});

describe('a lift/gamma/gain range', () => {
  it('is its amount in each channel when white', () => {
    expect(toneRange({ colour: '#ffffff', amount: 2 })).toEqual([2, 2, 2]);
  });

  it('leans toward its colour without its brightness', () => {
    const [r, g, b] = toneRange({ colour: '#ff0000', amount: 1 });
    expect(r).toBeGreaterThan(1);
    expect(g).toBeLessThan(1);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b).toBeCloseTo(1);
  });
});

describe("the scenes' one Colour kept before they were graded", () => {
  it('is nothing where it was off', () => {
    expect(keptColourTint({ background: { on: false, colour: '#ff0000' } })).toBeNull();
  });

  it('is a theme colour where a preset was chosen, else the colour set by hand', () => {
    expect(keptColourTint({ background: { on: true }, choice: 'gold' })).toEqual({
      id: 'colour',
      kind: 'theme',
      strength: 1,
      preset: 'gold',
    });
    expect(
      keptColourTint({ background: { on: true, colour: '#00ff00', blend: 'color' }, choice: 'custom' }),
    ).toEqual({ ...pictureTint('#00ff00', 'color'), id: 'colour' });
  });
});
