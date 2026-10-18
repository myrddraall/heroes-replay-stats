import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishedDesignStore } from '../../scenes/play-background/published-design.store';
import { DraftDesignStore } from './draft-design.store';

const red = { colour: '#ff0000', blend: 'color', strength: 1 } as const;

describe('DraftDesignStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [DraftDesignStore] });
  });

  it('starts from what is published, with nothing unsaved', () => {
    TestBed.inject(PublishedDesignStore).publish({
      library: { planets: { korhal: { tint: red } }, styles: {}, sky: {} },
      scenes: { settings: { background: { on: false, colour: '#ffffff', blend: 'multiply' } }, planets: {} },
    });
    const draft = TestBed.inject(DraftDesignStore);
    expect(draft.library().planets['korhal']).toEqual({ tint: red });
    expect(draft.unsaved()).toBe(0);
  });

  it('counts each asset, scene, the sky and the colour changed once', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.setLibraryBody('planets', 'korhal', { lighting: 0.5 });
    draft.setLibraryMaterial('styles', 'nexus', 'shield', { glow: 2 });
    draft.setLibrarySkyTint(red);
    draft.setSkyTint('korhal', red);
    expect(draft.unsaved()).toBe(4);
    expect([...draft.unsavedLibraryPlanets()]).toEqual(['korhal']);
    expect([...draft.unsavedLibraryStyles()]).toEqual(['nexus']);
    expect(draft.unsavedLibrarySky()).toBe(true);
    expect([...draft.unsavedScenes()]).toEqual(['korhal']);
  });

  it('is not unsaved once an edit is taken back', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.resetLibraryBody('planets', 'korhal');
    expect(draft.unsaved()).toBe(0);
  });

  it('publishes on save and leaves the site alone until then', () => {
    const published = TestBed.inject(PublishedDesignStore);
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    expect(published.library().planets['korhal']).toBeUndefined();
    draft.save();
    expect(published.library().planets['korhal']).toEqual({ tint: red });
    expect(draft.unsaved()).toBe(0);
  });

  it('goes back to what is published on discard', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.discard();
    expect(draft.library().planets['korhal']).toBeUndefined();
    expect(draft.unsaved()).toBe(0);
  });
});
