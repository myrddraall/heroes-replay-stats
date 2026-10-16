import { describe, expect, it } from 'vitest';
import {
  NO_TINT,
  NO_TINTS,
  parseCanvasColour,
  rendererTints,
  sameTints,
  type Tint,
  UNTINTED,
} from './scene-tints';

/** Colours by name, for the tests: the browser parses them in the app. */
const parse = (css: string) =>
  (({ red: [1, 0, 0], blue: [0, 0, 1] }) as Record<string, [number, number, number]>)[css] ?? null;

describe('the tints the renderer draws', () => {
  it('are none when nothing is tinted', () => {
    expect(rendererTints(UNTINTED, parse)).toEqual(NO_TINTS);
  });

  it('tint the planets as the background where they have none of their own', () => {
    const tints = rendererTints({ background: { colour: 'red', blend: 'hue' }, planets: {} }, parse);
    expect(tints.every((t: Tint) => t.blend === 'hue' && t.colour.join() === '1,0,0')).toBe(true);
  });

  it('tint a planet on its own', () => {
    const [background, large, medium] = rendererTints(
      {
        background: { colour: 'red', blend: 'color' },
        planets: { large: { colour: 'blue', blend: 'multiply' } },
      },
      parse,
    );
    expect(background).toEqual({ colour: [1, 0, 0], blend: 'color' });
    expect(large).toEqual({ colour: [0, 0, 1], blend: 'multiply' });
    expect(medium).toEqual(background);
  });

  it("tint nothing with what isn't a colour", () => {
    const [background] = rendererTints({ background: { colour: 'nope', blend: 'hue' }, planets: {} }, parse);
    expect(background).toEqual(NO_TINT);
  });

  it('tell when they changed', () => {
    const red = rendererTints({ background: { colour: 'red', blend: 'multiply' }, planets: {} }, parse);
    expect(sameTints(red, [...red])).toBe(true);
    expect(sameTints(red, NO_TINTS)).toBe(false);
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
