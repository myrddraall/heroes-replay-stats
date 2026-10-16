import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BackgroundStore } from './background.store';

describe('BackgroundStore', () => {
  const root = () => document.documentElement.style;

  it('puts the tints on the root for the interface, a planet without its own as the background', () => {
    const store = TestBed.inject(BackgroundStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    store.setPlanetTint('large', { colour: '#00ff00', blend: 'hue' });
    TestBed.tick();
    expect(root().getPropertyValue('--hrs-background-tint')).toBe('#ff0000');
    expect(root().getPropertyValue('--hrs-background-tint-blend')).toBe('color');
    expect(root().getPropertyValue('--hrs-planet-large-tint')).toBe('#00ff00');
    expect(root().getPropertyValue('--hrs-planet-large-tint-blend')).toBe('hue');
    expect(root().getPropertyValue('--hrs-planet-medium-tint')).toBe('#ff0000');
  });

  it('takes them off the root when nothing is tinted', () => {
    const store = TestBed.inject(BackgroundStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    TestBed.tick();
    store.setBackgroundTint(null);
    TestBed.tick();
    expect(root().getPropertyValue('--hrs-background-tint')).toBe('');
    expect(root().getPropertyValue('--hrs-planet-small-tint')).toBe('');
  });

  it("shows the open page's tints over the site's until it gives them back", () => {
    const store = TestBed.inject(BackgroundStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    store.setPageTints({ background: { colour: '#0000ff', blend: 'hue' }, planets: {} });
    expect(store.tints().background).toEqual({ colour: '#0000ff', blend: 'hue' });
    store.setPageTints(null);
    expect(store.tints().background).toEqual({ colour: '#ff0000', blend: 'color' });
  });

  it('draws at the interacting frame rate while anything holds it', () => {
    const store = TestBed.inject(BackgroundStore);
    store.setDrawing({ animate: true, idleFps: 12, animationFps: 60, interactingFps: 3, resolution: 1 });
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
