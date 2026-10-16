import { describe, expect, it } from 'vitest';
import { UNTINTED, tintStyles } from './tint-settings';

describe('the tint settings', () => {
  it('set nothing when nothing is tinted', () => {
    expect(Object.values(tintStyles(UNTINTED)).every((value) => value === null)).toBe(true);
  });

  it('set the background and a planet with its own tint, leaving the others to follow', () => {
    const styles = tintStyles({
      ...UNTINTED,
      background: { on: true, colour: '#00ff00', blend: 'color' },
      large: { on: true, colour: '#ffcc00', blend: 'multiply' },
    });
    expect(styles).toEqual({
      '--hrs-background-tint': '#00ff00',
      '--hrs-background-tint-blend': 'color',
      '--hrs-planet-large-tint': '#ffcc00',
      '--hrs-planet-large-tint-blend': 'multiply',
      '--hrs-planet-medium-tint': null,
      '--hrs-planet-medium-tint-blend': null,
      '--hrs-planet-small-tint': null,
      '--hrs-planet-small-tint-blend': null,
    });
  });
});
