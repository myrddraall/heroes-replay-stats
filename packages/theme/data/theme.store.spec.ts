import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../model';
import { THEME_STORAGE_KEY, ThemeStore } from './theme.store';

describe('ThemeStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts at the defaults, saving nothing until the user chooses', () => {
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe('purple');
    expect(store.opacity()).toBe(0);
    expect(store.blur()).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('remembers what was chosen, each value within its range', () => {
    TestBed.inject(ThemeStore).set({ theme: 'magenta', opacity: 2, blur: true });
    TestBed.resetTestingModule();
    const again = TestBed.inject(ThemeStore);
    expect(again.theme()).toBe('magenta');
    expect(again.opacity()).toBe(1);
    expect(again.blur()).toBe(true);
    again.set({ opacity: -1 });
    expect(again.opacity()).toBe(0);
  });

  it('ignores values that are not values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'pink', opacity: 0.3 }));
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe(DEFAULT_THEME.theme);
    expect(store.opacity()).toBe(0.3);
  });

  it("carries the glass theme's choices over: its neutrals renamed, its opacities dropped, its blur kept", () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ theme: 'nexus', glassAlpha: 0.4, frameAlpha: 0.7, blur: true }),
    );
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe('cyan');
    expect(store.opacity()).toBe(0);
    expect(store.blur()).toBe(true);
    store.set({ opacity: 0.25 });
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!)).toEqual({
      theme: 'cyan',
      blur: true,
      opacity: 0.25,
    });

    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme: 'neutral' }));
    TestBed.resetTestingModule();
    expect(TestBed.inject(ThemeStore).theme()).toBe('purple');
  });

  it('reads nothing from the Graphics settings', () => {
    localStorage.setItem('hrs.graphics', JSON.stringify({ theme: 'nexus' }));
    localStorage.setItem('hrs.graphics.quality', 'ultra');
    const store = TestBed.inject(ThemeStore);
    expect(store.theme()).toBe('purple');
    expect(store.blur()).toBe(false);
  });
});
