import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { routes } from './app.routes';
import { PLATFORM } from '@myrddraall/heroes-replay-stats-platform/data';
import type { Platform } from '@myrddraall/heroes-replay-stats-platform/model';
import {
  REPLAY_DB,
  REPLAY_DB_FACTORY,
  ReplayImportJobStore,
} from '@myrddraall/heroes-replay-stats-import/data';
import { DEV_ROUTES, provideDevFeature } from '@myrddraall/heroes-replay-stats-dev/provide';
import { provideImportFeature } from '@myrddraall/heroes-replay-stats-import/provide';
import { provideMapsFeature } from '@myrddraall/heroes-replay-stats-maps/provide';
import { providePlayersFeature } from '@myrddraall/heroes-replay-stats-players/provide';
import { provideReplaysFeature } from '@myrddraall/heroes-replay-stats-replays/provide';
import { Shell } from '@myrddraall/heroes-replay-stats-shell/feature';
import { provideSettingsFeature } from '@myrddraall/heroes-replay-stats-settings/provide';
import { provideThemeFeature } from '@myrddraall/heroes-replay-stats-theme/provide';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { provideShellArea } from '@myrddraall/heroes-replay-stats-shell/ui';
import {
  BACKGROUND_EDITOR,
  provideBackgroundFeature,
} from '@myrddraall/heroes-replay-stats-background/provide';

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
        provideBackgroundFeature(),
        provideDevFeature(),
        provideImportFeature(),
        provideMapsFeature({ packsUrl: 'maps/' }),
        providePlayersFeature(),
        provideReplaysFeature(),
        provideSettingsFeature(),
        provideThemeFeature(),
        provideFakeSheets(),
        provideShellArea({ path: '/replays', label: 'Replays', order: 10 }),
        provideShellArea({ path: '/game-info', label: 'Game Info', order: 20 }),
        provideRouter(routes),
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

  it('renders the areas on the top bar, and the settings menu button', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const areas = [...el.querySelectorAll('.hrs-nav1 > li a')].map((a) => a.getAttribute('href'));
    expect(areas).toEqual(['/replays', '/game-info', '/about']);
    expect(el.querySelector('.hrs-topbar__tools button[aria-label="Settings"]')).not.toBeNull();
    expect(el.querySelector('.import-pod a')?.getAttribute('href')).toBe('/replays/import');
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
    expect(routes.map((r) => r.path)).toEqual(['', 'replays', 'game-info', 'game', '**']);
    expect(DEV_ROUTES.find((r) => r.path === 'renderer-check')?.data?.['shell']).toBe(false);
    expect(BACKGROUND_EDITOR.routeData?.['shell']).toBe(false);
  });
});
