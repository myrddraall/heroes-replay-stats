import { describe, expect, it } from 'vitest';
import { backgroundTints, UNTINTED } from './tint-settings';

describe('the tint settings', () => {
  it('tint nothing when nothing is switched on', () => {
    expect(backgroundTints(UNTINTED)).toEqual({ background: null, planets: {} });
  });

  it('tint the background and the planets with their own, leaving the others to follow', () => {
    expect(
      backgroundTints({
        ...UNTINTED,
        background: { on: true, colour: '#00ff00', blend: 'color' },
        large: { on: true, colour: '#ffcc00', blend: 'multiply' },
      }),
    ).toEqual({
      background: { colour: '#00ff00', blend: 'color' },
      planets: { large: { colour: '#ffcc00', blend: 'multiply' } },
    });
  });
});
