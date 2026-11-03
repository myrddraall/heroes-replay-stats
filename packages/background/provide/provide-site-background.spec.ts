import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ViewStore } from "@myrddraall/heroes-replay-stats-aether";
import { beforeEach, describe, expect, it } from 'vitest';
import { provideSiteBackground } from './provide-site-background';

describe('provideSiteBackground', () => {
  const root = () => document.documentElement.style;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideSiteBackground(), provideRouter([])] });
    TestBed.tick();
  });

  it('puts the tint on the root for the interface', () => {
    const store = TestBed.inject(ViewStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    TestBed.tick();
    expect(root().getPropertyValue('--hrs-background-tint')).toBe('#ff0000');
    expect(root().getPropertyValue('--hrs-background-tint-blend')).toBe('color');
  });

  it('takes it off the root when nothing is tinted', () => {
    const store = TestBed.inject(ViewStore);
    store.setBackgroundTint({ colour: '#ff0000', blend: 'color' });
    TestBed.tick();
    store.setBackgroundTint(null);
    TestBed.tick();
    expect(root().getPropertyValue('--hrs-background-tint')).toBe('');
    expect(root().getPropertyValue('--hrs-background-tint-blend')).toBe('');
  });
});
