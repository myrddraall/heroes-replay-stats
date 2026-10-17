import { describe, expect, it } from 'vitest';
import type { PackTeamColours } from '../src/lib/pack/map-pack';
import {
  applyTeamColours,
  isAsShot,
  swappedTeamColours,
  teamColoursKey,
} from '../src/lib/layers/team-colour';
import { fixturePack } from './fixtures';

const shot: PackTeamColours = { order: [101, 159, 255], chaos: [255, 57, 48], maskScale: 2 };

describe('team colour', () => {
  it('swaps the colours as shot, and knows them', () => {
    const swapped = swappedTeamColours(shot);
    expect(swapped).toEqual({ order: [255, 57, 48], chaos: [101, 159, 255] });
    expect(isAsShot(null, shot)).toBe(true);
    expect(isAsShot({ order: shot.order, chaos: shot.chaos }, shot)).toBe(true);
    expect(isAsShot(swapped, shot)).toBe(false);
    expect(teamColoursKey(swapped)).toBe('255,57,48/101,159,255');
  });

  it("adds each team's change in the amount its mask gives, alpha and unmasked pixels untouched", () => {
    // Pixel 0: Order's team, 0.4 of the colour (byte 51 = 0.4 at a scale of 2); pixel 1: Chaos's,
    // byte 26 (0.204); pixel 2: none.
    const rgba = new Uint8ClampedArray([100, 120, 200, 255, 160, 60, 60, 200, 10, 20, 30, 128]);
    const mask = new Uint8ClampedArray([51, 0, 0, 255, 0, 26, 0, 255, 0, 0, 0, 255]);
    applyTeamColours(rgba, mask, shot, swappedTeamColours(shot));
    // Order's team blue to red: + 0.4 * (red - blue) = (+61.6, -40.8, -82.8).
    expect([...rgba.slice(0, 4)]).toEqual([162, 79, 117, 255]);
    // Chaos's team red to blue: + 0.204 * (blue - red) = (-31.4, +20.8, +42.2); alpha kept.
    expect([...rgba.slice(4, 8)]).toEqual([129, 81, 102, 200]);
    expect([...rgba.slice(8, 12)]).toEqual([10, 20, 30, 128]);
  });

  it('clamps to the colour range, and changes nothing with the colours as shot', () => {
    const rgba = new Uint8ClampedArray([250, 5, 250, 255]);
    applyTeamColours(rgba, new Uint8ClampedArray([255, 0, 0, 255]), shot, swappedTeamColours(shot));
    expect([...rgba]).toEqual([255, 0, 0, 255]);
    const same = new Uint8ClampedArray([100, 120, 200, 255]);
    applyTeamColours(same, new Uint8ClampedArray([200, 100, 0, 255]), shot, { order: shot.order, chaos: shot.chaos });
    expect([...same]).toEqual([100, 120, 200, 255]);
  });

  it('reads a format 6 pack', () => {
    const pack = fixturePack('battlefield-of-eternity');
    expect(pack.format).toBe(6);
    expect(pack.teamColours).toEqual(shot);
  });
});
