import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EDITING_AIDS_DEFAULTS, EditingAidsStore } from './editing-aids.store';

describe('EditingAidsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EditingAidsStore] });
  });

  it('starts on the medium grid, and shows the game sky where asked', () => {
    const aids = TestBed.inject(EditingAidsStore);
    expect(aids.rendererBackdrop()).toEqual({
      kind: 'grid',
      size: 16,
      colours: [
        [1, 1, 1],
        [0.8, 0.8, 0.8],
      ],
    });
    aids.set({ backdrop: 'sky' });
    expect(aids.rendererBackdrop()).toBeNull();
    aids.set({ backdrop: 'colour', backdropColour: '#ff8000' });
    expect(aids.rendererBackdrop()).toEqual({ kind: 'colour', colour: [1, 128 / 255, 0] });
    aids.set({ backdrop: 'grid', gridSize: 'large' });
    expect(aids.rendererBackdrop()).toEqual({
      kind: 'grid',
      size: 32,
      colours: [
        [1, 1, 1],
        [0.8, 0.8, 0.8],
      ],
    });
  });

  it('puts aids back as they start', () => {
    const aids = TestBed.inject(EditingAidsStore);
    aids.set({ standIn: 'colour', standInColour: '#123456', materialOnPlanet: true });
    aids.reset(['standIn', 'standInColour']);
    expect(aids.standIn()).toBe(EDITING_AIDS_DEFAULTS.standIn);
    expect(aids.standInColour()).toBe(EDITING_AIDS_DEFAULTS.standInColour);
    expect(aids.materialOnPlanet()).toBe(true);
  });
});
