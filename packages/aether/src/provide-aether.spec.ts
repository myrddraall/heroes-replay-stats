import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GraphicsSettingsStore, HARDWARE_ACCELERATION, QUALITY_PRESETS } from './graphics';
import { provideAether } from './provide-aether';
import { RENDER_API } from './render/render-api';
import { ViewStore } from './view/view.store';

describe('provideAether', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideAether({ dataUrl: 'data/' }),
        { provide: HARDWARE_ACCELERATION, useValue: true },
      ],
    });
  });

  it('has the background drawn as the graphics settings say, and the renderer made for their API', () => {
    const graphics = TestBed.inject(GraphicsSettingsStore);
    const view = TestBed.inject(ViewStore);
    TestBed.tick();
    expect(view.drawing()).toEqual(QUALITY_PRESETS.high);
    graphics.setQuality('low');
    graphics.set({ api: 'webgl2' });
    TestBed.tick();
    expect(view.drawing()).toEqual(QUALITY_PRESETS.low);
    expect(TestBed.inject(RENDER_API)()).toBe('webgl2');
  });
});
