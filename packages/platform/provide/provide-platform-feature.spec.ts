import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { PLATFORM } from '../data';
import { providePlatformFeature } from './provide-platform-feature';

describe('providePlatformFeature', () => {
  afterEach(() => {
    delete window.heroesDesktop;
    TestBed.resetTestingModule();
  });

  it('is the browser platform when no desktop bridge exists', () => {
    TestBed.configureTestingModule({ providers: [providePlatformFeature({ version: '0.1.0' })] });
    expect(TestBed.inject(PLATFORM).kind).toBe('web');
    expect(TestBed.inject(PLATFORM).version).toBe('0.1.0');
  });

  it('is the desktop platform when the preload bridge is present', async () => {
    window.heroesDesktop = {
      version: '1.2.3',
      pickReplays: async () => [
        { name: 'a.StormReplay', path: '/replays/a.StormReplay', bytes: new Uint8Array([1]) },
      ],
      defaultReplayDirectory: async () => '/replays',
    };
    TestBed.configureTestingModule({ providers: [providePlatformFeature({ version: '0.1.0' })] });
    const platform = TestBed.inject(PLATFORM);
    expect(platform.kind).toBe('desktop');
    expect(platform.version).toBe('1.2.3');
    expect((await platform.pickReplays())[0]).toEqual({
      name: 'a.StormReplay',
      path: '/replays/a.StormReplay',
      bytes: new Uint8Array([1]),
    });
    expect(await platform.defaultReplayDirectory()).toBe('/replays');
  });
});
