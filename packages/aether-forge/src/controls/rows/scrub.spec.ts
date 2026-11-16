import { describe, expect, it } from 'vitest';
import {
  clamped,
  decimalsOf,
  limitsText,
  SCRUB_DEAD_ZONE,
  scrubRate,
  stepped,
  stepsFor,
  wheelPixels,
} from './scrub';

describe('a scrubbed number', () => {
  it('stays put until the pointer leaves the dead zone', () => {
    expect(scrubRate(SCRUB_DEAD_ZONE, 1)).toBe(0);
    expect(scrubRate(-SCRUB_DEAD_ZONE, 1)).toBe(0);
  });

  it('goes up above where it was pressed, down below, faster the further away', () => {
    const near = scrubRate(SCRUB_DEAD_ZONE + 10, 1);
    const far = scrubRate(SCRUB_DEAD_ZONE + 20, 1);
    expect(near).toBeCloseTo(1); // a step a second
    expect(far).toBeCloseTo(4);
    expect(scrubRate(-(SCRUB_DEAD_ZONE + 10), 1)).toBeCloseTo(-1);
  });

  it('moves in its own steps', () => {
    expect(scrubRate(SCRUB_DEAD_ZONE + 10, 0.01)).toBeCloseTo(0.01);
  });

  it('is kept to its step and limits, where it has them', () => {
    expect(stepped(0.30000000000000004, 0.1)).toBe(0.3);
    expect(stepped(1.234, 0.05)).toBe(1.25);
    expect(stepped(-3, 0.5, 0)).toBe(0);
    expect(stepped(250, 1)).toBe(250);
    expect(clamped(5, undefined, 4)).toBe(4);
    expect(decimalsOf(0.005)).toBe(3);
    expect(decimalsOf(1)).toBe(0);
  });

  it('shows its limits', () => {
    expect(limitsText(0, 1)).toBe('0 – 1');
    expect(limitsText(0, undefined)).toBe('≥ 0');
    expect(limitsText(undefined, 1)).toBe('≤ 1');
    expect(limitsText(undefined, undefined)).toBe('Any');
  });

  it('steps further with Shift, and further still with Alt', () => {
    const keys = { shiftKey: false, altKey: false };
    expect(stepsFor(keys)).toBe(1);
    expect(stepsFor({ ...keys, shiftKey: true })).toBe(10);
    expect(stepsFor({ ...keys, altKey: true })).toBe(100);
    expect(stepsFor({ shiftKey: true, altKey: true })).toBe(100);
  });

  it('reads a wheel in pixels, by lines or pages, down or (with Shift, in some browsers) across', () => {
    expect(wheelPixels({ deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe(100);
    expect(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe(99);
    expect(wheelPixels({ deltaX: -100, deltaY: 0, deltaMode: 0 })).toBe(-100);
  });
});
