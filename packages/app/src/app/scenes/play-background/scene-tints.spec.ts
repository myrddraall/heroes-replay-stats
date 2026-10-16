import { describe, expect, it } from 'vitest';
import { NO_TINT, NO_TINTS, parseCanvasColour, readTints, sameTints } from './scene-tints';

/** A computed style holding these custom properties. */
const style = (properties: Record<string, string>) =>
  ({ getPropertyValue: (name: string) => properties[name] ?? '' }) as CSSStyleDeclaration;

/** Colours by name, for the tests: the browser parses them in the app. */
const parse = (css: string) =>
  (({ red: [1, 0, 0], blue: [0, 0, 1] }) as Record<string, [number, number, number]>)[css] ?? null;

describe('the tints', () => {
  it('are none when nothing is set', () => {
    expect(readTints(style({}), parse)).toEqual(NO_TINTS);
  });

  it('tint the planets as the background where they set nothing of their own', () => {
    const tints = readTints(
      style({ '--hrs-background-tint': 'red', '--hrs-background-tint-blend': 'hue' }),
      parse,
    );
    expect(tints.every((t) => t.blend === 'hue' && t.colour.join() === '1,0,0')).toBe(true);
  });

  it('tint a planet on its own, multiplying unless it says how to blend', () => {
    const [background, large, medium] = readTints(
      style({
        '--hrs-background-tint': 'red',
        '--hrs-background-tint-blend': 'color',
        '--hrs-planet-large-tint': 'blue',
        '--hrs-planet-medium-tint-blend': 'hue',
      }),
      parse,
    );
    expect(background).toEqual({ colour: [1, 0, 0], blend: 'color' });
    expect(large).toEqual({ colour: [0, 0, 1], blend: 'multiply' });
    expect(medium).toEqual({ colour: [1, 0, 0], blend: 'hue' });
  });

  it('ignore what isn\'t a colour or a blend', () => {
    const [background] = readTints(
      style({ '--hrs-background-tint': 'nope', '--hrs-background-tint-blend': 'screen' }),
      parse,
    );
    expect(background).toEqual(NO_TINT);
  });

  it('tell when they changed', () => {
    const red = readTints(style({ '--hrs-background-tint': 'red' }), parse);
    expect(sameTints(red, readTints(style({ '--hrs-background-tint': 'red' }), parse))).toBe(true);
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
