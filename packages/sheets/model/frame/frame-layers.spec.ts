import { describe, expect, it } from 'vitest';
import { frameLayerShown, frameLayerStates } from './frame-layers';

describe('frameLayerStates', () => {
  it('reads one state, several separated by commas, or none', () => {
    expect(frameLayerStates('chosen')).toEqual(['chosen']);
    expect(frameLayerStates(' chosen , chosen-locked ')).toEqual(['chosen', 'chosen-locked']);
    expect(frameLayerStates('')).toEqual([]);
    expect(frameLayerStates(undefined)).toEqual([]);
  });
});

describe('frameLayerShown', () => {
  it("shows a slot's layers for the frame's state, or else its default", () => {
    // a state the slot has a layer for: that layer, not the default
    expect(frameLayerShown(['chosen'], 'chosen', true)).toBe(true);
    expect(frameLayerShown([], 'chosen', true)).toBe(false);
    // a state the slot has no layer for: the default
    expect(frameLayerShown([], 'locked', false)).toBe(true);
    expect(frameLayerShown(['chosen'], 'locked', false)).toBe(false);
    // no state: the defaults only
    expect(frameLayerShown([], null, false)).toBe(true);
    expect(frameLayerShown(['chosen'], null, false)).toBe(false);
  });
});
