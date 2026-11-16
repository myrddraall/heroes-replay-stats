import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ViewStore } from './view.store';

describe('ViewStore', () => {
  it("shows the open page's tints over the site's until it gives them back", () => {
    const store = TestBed.inject(ViewStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    store.setPageTints({ background: { colour: '#0000ff', blend: 'hue' } });
    expect(store.tints().background).toEqual({ colour: '#0000ff', blend: 'hue' });
    store.setPageTints(null);
    expect(store.tints().background).toEqual({ colour: '#ff0000', blend: 'color' });
  });

  it('draws at the interacting frame rate while anything holds it', () => {
    const store = TestBed.inject(ViewStore);
    store.setDrawing({
      animate: true,
      idleFps: 12,
      animationFps: 60,
      interactingFps: 3,
      resolution: 1,
    });
    expect([store.fps(), store.fadeFps()]).toEqual([12, 60]);
    const map = store.requestInteracting();
    const other = store.requestInteracting();
    expect([store.fps(), store.fadeFps()]).toEqual([3, 3]);
    map();
    map(); // once only
    expect(store.fps()).toBe(3);
    other();
    expect([store.fps(), store.fadeFps()]).toEqual([12, 60]);
  });
});
