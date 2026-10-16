import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_GRAPHICS,
  CUSTOM_STORAGE_KEY,
  GRAPHICS_STORAGE_KEY,
  GraphicsStore,
  QUALITY_STORAGE_KEY,
  QUALITIES,
  QUALITY_PRESETS,
  qualityOf,
} from './graphics.store';
import { HARDWARE_ACCELERATION } from './hardware-acceleration';

/** The browser draws on the GPU, or (false) on the CPU. */
function accelerated(on = true): void {
  TestBed.configureTestingModule({ providers: [{ provide: HARDWARE_ACCELERATION, useValue: on }] });
}

describe('GraphicsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    accelerated();
  });

  it('starts at High, saving nothing until the user chooses', () => {
    const store = TestBed.inject(GraphicsStore);
    expect(store.quality()).toBe('high');
    expect(store.theme()).toBe('neutral');
    expect(store.colourMode()).toBe('fixed');
    expect(localStorage.length).toBe(0);
  });

  it('keeps a preset as its id, and a custom quality as all its settings', () => {
    const store = TestBed.inject(GraphicsStore);
    store.setQuality('medium');
    expect(localStorage.getItem(QUALITY_STORAGE_KEY)).toBe('medium');
    store.set({ idleFps: 20 });
    const custom = { ...QUALITY_PRESETS.medium, idleFps: 20 };
    expect(JSON.parse(localStorage.getItem(QUALITY_STORAGE_KEY)!)).toEqual(custom);
    expect(JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)!)).toEqual(custom);
    store.setQuality('ultra');
    expect(localStorage.getItem(QUALITY_STORAGE_KEY)).toBe('ultra');
    expect(JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)!)).toEqual(custom);
    store.set({ theme: 'nexus' });
    expect(JSON.parse(localStorage.getItem(GRAPHICS_STORAGE_KEY)!)).toEqual({ theme: 'nexus' });
    expect(localStorage.getItem(QUALITY_STORAGE_KEY)).toBe('ultra');
  });

  it('starts at Low without hardware acceleration, saving nothing, until a quality is chosen', () => {
    TestBed.resetTestingModule();
    accelerated(false);
    const store = TestBed.inject(GraphicsStore);
    expect(store.quality()).toBe('low');
    expect(store.custom()).toBeNull();
    expect(localStorage.length).toBe(0);
    store.setQuality('ultra');

    TestBed.resetTestingModule();
    accelerated(false);
    expect(TestBed.inject(GraphicsStore).quality()).toBe('ultra'); // chosen: not detected again
  });

  it('knows each preset by its values', () => {
    for (const q of QUALITIES) expect(qualityOf(QUALITY_PRESETS[q])).toBe(q);
  });

  it('sets a preset, and is custom once one of its values is changed', () => {
    const store = TestBed.inject(GraphicsStore);
    store.setQuality('low');
    expect(store.animate()).toBe(false);
    expect(store.quality()).toBe('low');
    store.set({ resolution: 0.6 });
    expect(store.quality()).toBe('custom');
    store.set({ resolution: 0.5 });
    expect(store.quality()).toBe('low');
  });

  it('remembers what was chosen, each value within its range', () => {
    const store = TestBed.inject(GraphicsStore);
    store.set({ idleFps: 500, interactingFps: -3, glassAlpha: 0, theme: 'nexus', colour: 'gold' });
    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsStore);
    expect(again.idleFps()).toBe(120);
    expect(again.interactingFps()).toBe(0);
    expect(again.glassAlpha()).toBe(0.06);
    expect(again.theme()).toBe('nexus');
    expect(again.colour()).toBe('gold');
  });

  it('ignores broken storage and values that are not values', () => {
    localStorage.setItem(
      GRAPHICS_STORAGE_KEY,
      JSON.stringify({ theme: 'pink', colour: 'nope', glassAlpha: 0.3 }),
    );
    localStorage.setItem(QUALITY_STORAGE_KEY, 'superb');
    const store = TestBed.inject(GraphicsStore);
    expect(store.theme()).toBe(DEFAULT_GRAPHICS.theme);
    expect(store.colour()).toBe(DEFAULT_GRAPHICS.colour);
    expect(store.glassAlpha()).toBe(0.3);
    expect(store.quality()).toBe('high');

    localStorage.setItem(GRAPHICS_STORAGE_KEY, '{nope');
    localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify({ idleFps: 30 })); // not all of it
    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsStore);
    expect(again.quality()).toBe('high');
    expect(again.glassAlpha()).toBe(DEFAULT_GRAPHICS.glassAlpha);
  });

  it('keeps the last custom quality through presets, and a change at no preset replaces it', () => {
    const store = TestBed.inject(GraphicsStore);
    expect(store.custom()).toBeNull();
    store.set({ idleFps: 20 });
    store.setQuality('medium');
    store.set({ theme: 'nexus' }); // not the quality: still Medium, the custom one kept
    store.set({ resolution: 0.75 }); // a value, but still Medium: kept
    expect(store.custom()?.idleFps).toBe(20);

    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsStore);
    expect(again.quality()).toBe('medium');
    again.restoreCustom();
    expect(again.quality()).toBe('custom');
    expect(again.idleFps()).toBe(20);
    expect(again.resolution()).toBe(1);

    again.set({ idleFps: 25 });
    again.setQuality('low');
    again.restoreCustom();
    expect(again.idleFps()).toBe(25);
  });
});
