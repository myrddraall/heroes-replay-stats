import { describe, expect, it } from 'vitest';
import { NO_TINT, parseCanvasColour, rendererTint, sameTint, NO_TINTS } from './tints';

/** Colours by name, for the tests: the browser parses them in the app. */
const parse = (css: string) =>
  (({ red: [1, 0, 0], blue: [0, 0, 1] }) as Record<string, [number, number, number]>)[css] ?? null;

describe('the tint the renderer draws', () => {
  it('is none when nothing is tinted', () => {
    expect(rendererTint(NO_TINTS, parse)).toEqual(NO_TINT);
  });

  it('is the background’s colour and blend', () => {
    expect(rendererTint({ background: { colour: 'red', blend: 'hue' } }, parse)).toEqual({
      colour: [1, 0, 0],
      blend: 'hue',
    });
  });

  it("is none with what isn't a colour", () => {
    expect(rendererTint({ background: { colour: 'nope', blend: 'hue' } }, parse)).toEqual(NO_TINT);
  });

  it('tells when it changed', () => {
    const red = rendererTint({ background: { colour: 'red', blend: 'multiply' } }, parse);
    expect(sameTint(red, { ...red })).toBe(true);
    expect(sameTint(red, NO_TINT)).toBe(false);
  });
});

describe('a colour the canvas gives back', () => {
  it('reads hex', () => {
    expect(parseCanvasColour('#ff8000')).toEqual([1, 128 / 255, 0]);
  });

  it('takes a translucent one that much of the way from white', () => {
    expect(parseCanvasColour('rgba(255, 0, 0, 0.5)')).toEqual([1, 0.5, 0.5]);
  });

  it('is nothing when it is neither', () => {
    expect(parseCanvasColour('red')).toBeNull();
  });
});
