import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EDITING_AIDS_DEFAULTS, EditingAidsStore } from './editing-aids.store';
import { backdropOf, previewDefault } from './preview-setup';

describe('EditingAidsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EditingAidsStore] });
  });

  it('starts each kind as it suits: a planet on the sky, an overlay on the grid, a glow and particles on black', () => {
    expect(backdropOf(previewDefault('planet'))).toBeNull();
    expect(backdropOf(previewDefault('style'))).toEqual({
      kind: 'grid',
      size: 16,
      colours: [
        [1, 1, 1],
        [0.8, 0.8, 0.8],
      ],
    });
    expect(backdropOf(previewDefault('material'))?.kind).toBe('grid');
    expect(backdropOf(previewDefault('material', true))).toEqual({
      kind: 'colour',
      colour: [0, 0, 0],
    });
    expect(backdropOf(previewDefault('particle'))).toEqual({ kind: 'colour', colour: [0, 0, 0] });
    expect(backdropOf({ ...previewDefault('style'), gridSize: 'large' })).toMatchObject({
      size: 32,
    });
  });

  it('keeps an item’s Preview stage its own, over its kind’s; puts it back; makes it its kind’s', () => {
    const aids = TestBed.inject(EditingAidsStore);
    const base = previewDefault('style');
    aids.setPreview('style:a', { backdrop: 'colour', backdropColour: '#ff8000', planet: 'korhal' });
    expect(aids.previewOf('style:a', 'style', base)).toMatchObject({
      backdrop: 'colour',
      backdropColour: '#ff8000',
      planet: 'korhal',
    });
    // Another overlay as its kind starts.
    expect(aids.previewOf('style:b', 'style', base)).toEqual(base);
    aids.clearPreview('style:a', ['planet']);
    expect(aids.previewOf('style:a', 'style', base).planet).toBeNull();
    // Made its kind's: every overlay not set otherwise shown so, its own let go of.
    aids.usePreviewForKind('style:a', 'style');
    expect(aids.previews()['style:a']).toBeUndefined();
    expect(aids.previewOf('style:b', 'style', base).backdropColour).toBe('#ff8000');
    // One set again keeps its own over the kind's; cleared, as the kind has it.
    aids.setPreview('style:b', { backdrop: 'grid' });
    expect(aids.previewOf('style:b', 'style', base).backdrop).toBe('grid');
    aids.clearPreview('style:b');
    expect(aids.previewOf('style:b', 'style', base).backdrop).toBe('colour');
  });

  it('puts aids back as they start', () => {
    const aids = TestBed.inject(EditingAidsStore);
    aids.set({ referenceScale: 2, referenceUp: 0.5 });
    aids.reset(['referenceScale']);
    expect(aids.referenceScale()).toBe(EDITING_AIDS_DEFAULTS.referenceScale);
    expect(aids.referenceUp()).toBe(0.5);
  });
});
