import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultParallelImports,
  deviceCores,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
} from './settings.store';

describe('SettingsStore', () => {
  beforeEach(() => localStorage.clear());

  it('defaults parallel imports to a quarter of the cores, within 1–16', () => {
    expect(defaultParallelImports(8)).toBe(2);
    expect(defaultParallelImports(16)).toBe(4);
    expect(defaultParallelImports(4)).toBe(1);
    expect(defaultParallelImports(2)).toBe(1);
    expect(defaultParallelImports(128)).toBe(16);
    expect(defaultParallelImports(undefined)).toBe(2);
    expect(defaultParallelImports(0)).toBe(2);
  });

  it("uses the device's default until the user picks, then remembers the pick", () => {
    const store = TestBed.inject(SettingsStore);
    expect(store.parallelImports()).toBe(defaultParallelImports(deviceCores()));
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull(); // the default is not saved

    store.setParallelImports(7);
    expect(store.parallelImports()).toBe(7);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual({ parallelImports: 7 });

    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsStore).parallelImports()).toBe(7);
  });

  it('keeps values within 1–16 and ignores broken storage', () => {
    const store = TestBed.inject(SettingsStore);
    store.setParallelImports(40);
    expect(store.parallelImports()).toBe(16);
    store.setParallelImports(0);
    expect(store.parallelImports()).toBe(1);
    store.setParallelImports(2.6);
    expect(store.parallelImports()).toBe(3);

    localStorage.setItem(SETTINGS_STORAGE_KEY, '{nope');
    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsStore).parallelImports()).toBe(
      defaultParallelImports(deviceCores()),
    );
  });

  it('remembers the accounts marked as me, and drops the rest when unmarked', () => {
    const store = TestBed.inject(SettingsStore);
    expect(store.meToonHandles()).toEqual([]);

    store.setMe('1-Hero-1-5750', true);
    store.setMe('2-Hero-1-42', true);
    store.setMe('1-Hero-1-5750', true); // already me: no duplicate
    expect(store.meToonHandles()).toEqual(['2-Hero-1-42', '1-Hero-1-5750']);

    store.setMe('2-Hero-1-42', false);
    expect(store.meToonHandles()).toEqual(['1-Hero-1-5750']);

    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsStore).meToonHandles()).toEqual(['1-Hero-1-5750']);
  });

  it('keeps each setting when the other is changed, and ignores malformed handles', () => {
    const store = TestBed.inject(SettingsStore);
    store.setParallelImports(5);
    store.setMe('1-Hero-1-5750', true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toEqual({
      parallelImports: 5,
      meToonHandles: ['1-Hero-1-5750'],
    });

    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ meToonHandles: ['1-Hero-1-5750', 7, null, '1-Hero-1-5750'] }),
    );
    TestBed.resetTestingModule();
    expect(TestBed.inject(SettingsStore).meToonHandles()).toEqual(['1-Hero-1-5750']);
  });
});
