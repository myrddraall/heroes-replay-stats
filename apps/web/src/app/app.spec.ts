import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideAether } from '@myrddraall/heroes-replay-stats-aether';
import { describe, expect, it, beforeEach } from 'vitest';
import { routes } from './app.routes';
import { PLATFORM } from '@myrddraall/heroes-replay-stats-platform/data';
import type { Platform } from '@myrddraall/heroes-replay-stats-platform/model';
import {
  REPLAY_DB,
  REPLAY_DB_FACTORY,
  ReplayImportJobStore,
} from '@myrddraall/heroes-replay-stats-import/data';
import { provideImportFeature } from '@myrddraall/heroes-replay-stats-import/provide';
import { providePlayersFeature } from '@myrddraall/heroes-replay-stats-players/provide';
import { Shell } from '@myrddraall/heroes-replay-stats-shell/feature';
import { provideSettingsFeature } from '@myrddraall/heroes-replay-stats-settings/provide';
import { provideAppShellSlots } from './shell-slots';
import { BACKGROUND_EDITOR } from './site-background/background-editor';

/** A drag event as jsdom cannot make one: a plain event with a fake dataTransfer. */
function dragEvent(type: string, files: File[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files, dropEffect: 'none' },
  });
  return event;
}

const fakePlatform: Platform = {
  kind: 'web',
  version: 'test',
  pickReplays: async () => [],
  defaultReplayDirectory: async () => undefined,
};

describe('App shell', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideImportFeature(),
        providePlayersFeature(),
        provideSettingsFeature(),
        provideRouter(routes),
        provideAppShellSlots(),
        provideAether({ dataUrl: 'backgrounds/play/' }),
        { provide: PLATFORM, useValue: fakePlatform },
        {
          provide: REPLAY_DB_FACTORY,
          useValue: () => {
            throw new Error('not in this test');
          },
        },
        {
          provide: REPLAY_DB,
          useValue: {
            listReplays: async () => [],
            ingest: () => {
              throw new Error('not in this test');
            },
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the brand, one nav link per section, and the platform badge', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.shell__toolbar-title')?.textContent).toContain('Heroes Replay Stats');
    const links = [...el.querySelectorAll('mat-nav-list a[mat-list-item]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual([
      '/replays',
      '/players',
      '/maps',
      '/import',
      '/theme-preview',
      '/edit-background',
      '/settings',
    ]);
    expect(el.querySelector('.shell__platform')?.textContent).toContain('test');
  });

  it('shows a drop overlay while files are dragged over the page and imports dropped replays', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const replay = new File([new Uint8Array([1])], 'game.StormReplay');
    const other = new File([new Uint8Array([1])], 'notes.txt');

    document.dispatchEvent(dragEvent('dragenter', [replay]));
    await fixture.whenStable();
    expect(el.querySelector('.shell__drop')).not.toBeNull();

    document.dispatchEvent(dragEvent('dragleave', [replay]));
    await fixture.whenStable();
    expect(el.querySelector('.shell__drop')).toBeNull();

    document.dispatchEvent(dragEvent('dragenter', [replay]));
    document.dispatchEvent(dragEvent('drop', [replay, other]));
    await fixture.whenStable();
    expect(el.querySelector('.shell__drop')).toBeNull();
    const jobs = TestBed.inject(ReplayImportJobStore).jobs();
    expect(jobs.map((j) => j.fileName)).toEqual(['game.StormReplay']);
  });

  it('frames the app pages, and leaves the renderer check and the background editor to fill the window', () => {
    expect(routes.map((r) => r.path)).toContain('replays');
    expect(routes.find((r) => r.path === 'renderer-check')?.data?.['shell']).toBe(false);
    expect(BACKGROUND_EDITOR.routeData?.['shell']).toBe(false);
  });
});
