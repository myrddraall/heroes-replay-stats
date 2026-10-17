import { describe, expect, it } from 'vitest';
import { backgroundTints, UNTINTED } from './tint-settings';

describe('the tint settings', () => {
  it('tint nothing when switched off', () => {
    expect(backgroundTints(UNTINTED)).toEqual({ background: null });
  });

  it('tint the background when switched on', () => {
    expect(
      backgroundTints({ background: { on: true, colour: '#00ff00', blend: 'color' } }),
    ).toEqual({ background: { colour: '#00ff00', blend: 'color' } });
  });
});
