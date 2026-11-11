import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QUALITIES, QUALITY_PRESETS, qualityOf } from './graphics-settings';
import { GraphicsSettingsStore } from './graphics-settings.store';
import { HARDWARE_ACCELERATION } from './hardware-acceleration';

/** Kept under Aether's own prefix, as no app gives one here. */
const QUALITY_KEY = 'aether.graphics.quality';
const CUSTOM_KEY = 'aether.graphics.custom';
const API_KEY = 'aether.graphics.api';

/** The browser draws on the GPU, or (false) on the CPU. */
function accelerated(on = true): void {
  TestBed.configureTestingModule({ providers: [{ provide: HARDWARE_ACCELERATION, useValue: on }] });
}

describe('GraphicsSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    accelerated();
  });

  it('starts at High with the best API, saving nothing until the user chooses', () => {
    const store = TestBed.inject(GraphicsSettingsStore);
    expect(store.quality()).toBe('high');
    expect(store.api()).toBe('auto');
    expect(localStorage.length).toBe(0);
  });

  it('keeps a preset as its id, and a custom quality as all its settings', () => {
    const store = TestBed.inject(GraphicsSettingsStore);
    store.setQuality('medium');
    expect(localStorage.getItem(QUALITY_KEY)).toBe('medium');
    store.set({ idleFps: 20 });
    const custom = { ...QUALITY_PRESETS.medium, idleFps: 20 };
    expect(JSON.parse(localStorage.getItem(QUALITY_KEY)!)).toEqual(custom);
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!)).toEqual(custom);
    store.setQuality('ultra');
    expect(localStorage.getItem(QUALITY_KEY)).toBe('ultra');
    expect(JSON.parse(localStorage.getItem(CUSTOM_KEY)!)).toEqual(custom);
  });

  it('starts at Low without hardware acceleration, saving nothing, until a quality is chosen', () => {
    TestBed.resetTestingModule();
    accelerated(false);
    const store = TestBed.inject(GraphicsSettingsStore);
    expect(store.quality()).toBe('low');
    expect(store.custom()).toBeNull();
    expect(localStorage.length).toBe(0);
    store.setQuality('ultra');

    TestBed.resetTestingModule();
    accelerated(false);
    expect(TestBed.inject(GraphicsSettingsStore).quality()).toBe('ultra'); // chosen: not detected again
  });

  it('knows each preset by its values', () => {
    for (const q of QUALITIES) expect(qualityOf(QUALITY_PRESETS[q])).toBe(q);
  });

  it('sets a preset, and is custom once one of its values is changed', () => {
    const store = TestBed.inject(GraphicsSettingsStore);
    store.setQuality('low');
    expect(store.animate()).toBe(false);
    expect(store.quality()).toBe('low');
    store.set({ resolution: 0.6 });
    expect(store.quality()).toBe('custom');
    store.set({ resolution: 0.5 });
    expect(store.quality()).toBe('low');
  });

  it('remembers what was chosen, each value within its range', () => {
    TestBed.inject(GraphicsSettingsStore).set({ idleFps: 500, interactingFps: -3, resolution: 0.1 });
    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsSettingsStore);
    expect(again.idleFps()).toBe(120);
    expect(again.interactingFps()).toBe(0);
    expect(again.resolution()).toBe(0.25);
  });

  it('draws with the best API until another is chosen, remembers it, and keeps it through presets', () => {
    const store = TestBed.inject(GraphicsSettingsStore);
    store.set({ api: 'webgl2' });
    store.setQuality('low');
    expect(store.api()).toBe('webgl2');
    expect(localStorage.getItem(API_KEY)).toBe('webgl2');
    TestBed.resetTestingModule();
    accelerated();
    expect(TestBed.inject(GraphicsSettingsStore).api()).toBe('webgl2');
    localStorage.setItem(API_KEY, 'vulkan');
    TestBed.resetTestingModule();
    accelerated();
    expect(TestBed.inject(GraphicsSettingsStore).api()).toBe('auto');
  });

  it('ignores broken storage and values that are not values', () => {
    localStorage.setItem(QUALITY_KEY, 'superb');
    expect(TestBed.inject(GraphicsSettingsStore).quality()).toBe('high');
    localStorage.setItem(QUALITY_KEY, JSON.stringify({ idleFps: 30 })); // not all of it
    localStorage.setItem(CUSTOM_KEY, '{nope');
    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsSettingsStore);
    expect(again.quality()).toBe('high');
    expect(again.custom()).toBeNull();
  });

  it('keeps the last custom quality through presets, and a change at no preset replaces it', () => {
    const store = TestBed.inject(GraphicsSettingsStore);
    expect(store.custom()).toBeNull();
    store.set({ idleFps: 20 });
    store.setQuality('medium');
    store.set({ api: 'webgpu' }); // not the quality: still Medium, the custom one kept
    store.set({ resolution: 0.75 }); // a value, but still Medium: kept
    expect(store.custom()?.idleFps).toBe(20);

    TestBed.resetTestingModule();
    accelerated();
    const again = TestBed.inject(GraphicsSettingsStore);
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
