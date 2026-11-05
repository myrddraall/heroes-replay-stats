import { describe, expect, it } from 'vitest';
import { parseCanvasColour } from './tints';

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
