import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BackgroundColourStore,
  COLOUR_STORAGE_KEY,
  DEFAULT_COLOUR,
} from './background-colour.store';

describe('BackgroundColourStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts fixed and untinted, saving nothing until the user chooses', () => {
    const store = TestBed.inject(BackgroundColourStore);
    expect(store.colourMode()).toBe('fixed');
    expect(store.colour()).toBe(DEFAULT_COLOUR.colour);
    expect(localStorage.length).toBe(0);
  });

  it('remembers what was chosen', () => {
    TestBed.inject(BackgroundColourStore).set({ colourMode: 'in-turn', colour: 'gold' });
    expect(JSON.parse(localStorage.getItem(COLOUR_STORAGE_KEY)!)).toEqual({
      colourMode: 'in-turn',
      colour: 'gold',
    });
    TestBed.resetTestingModule();
    const again = TestBed.inject(BackgroundColourStore);
    expect(again.colourMode()).toBe('in-turn');
    expect(again.colour()).toBe('gold');
  });

  it('ignores broken storage and values that are not values', () => {
    localStorage.setItem(
      COLOUR_STORAGE_KEY,
      JSON.stringify({ colourMode: 'pink', colour: 'nope' }),
    );
    const store = TestBed.inject(BackgroundColourStore);
    expect(store.colourMode()).toBe(DEFAULT_COLOUR.colourMode);
    expect(store.colour()).toBe(DEFAULT_COLOUR.colour);
    localStorage.setItem(COLOUR_STORAGE_KEY, '{nope');
    TestBed.resetTestingModule();
    expect(TestBed.inject(BackgroundColourStore).colourMode()).toBe('fixed');
  });
});
