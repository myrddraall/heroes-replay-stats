import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../model';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

describe('ThemeStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts at the defaults, saving nothing until the user chooses', () => {
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe('neutral');
    expect(store.blur()).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('remembers what was chosen, each value within its range', () => {
    TestBed.inject(ThemeStore).set({ theme: 'nexus', glassAlpha: 0, frameAlpha: 2, blur: true });
    TestBed.resetTestingModule();
    const again = TestBed.inject(ThemeStore);
    expect(again.theme()).toBe('nexus');
    expect(again.glassAlpha()).toBe(0.06);
    expect(again.frameAlpha()).toBe(1);
    expect(again.blur()).toBe(true);
  });

  it('ignores values that are not values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'pink', glassAlpha: 0.3 }));
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe(DEFAULT_THEME.theme);
    expect(store.glassAlpha()).toBe(0.3);
  });

  it('takes what the Graphics settings had until the user chooses: Ultra and Extreme blurred', () => {
    localStorage.setItem('hrs.graphics', JSON.stringify({ theme: 'nexus', glassAlpha: 0.4, colour: 'gold' }));
    localStorage.setItem('hrs.graphics.quality', 'ultra');
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe('nexus');
    expect(store.glassAlpha()).toBe(0.4);
    expect(store.blur()).toBe(true);
    store.set({ frameAlpha: 0.7 });
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!)).toEqual({
      theme: 'nexus',
      glassAlpha: 0.4,
      blur: true,
      frameAlpha: 0.7,
    });
  });

  it("takes a custom quality's blur", () => {
    localStorage.setItem('hrs.graphics.quality', JSON.stringify({ idleFps: 20, blur: true }));
    expect(TestBed.inject(ThemeStore).blur()).toBe(true);
    TestBed.resetTestingModule();
    localStorage.setItem('hrs.graphics.quality', 'medium');
    expect(TestBed.inject(ThemeStore).blur()).toBe(false);
  });
});
