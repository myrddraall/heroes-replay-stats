import { provideRouter, UrlSegment } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { editBackgroundMatcher, routes } from './app.routes';
import { REPLAY_DB, REPLAY_DB_FACTORY } from './data/import/provide-replay-db';
import { PLATFORM, type Platform } from './platform/platform';
import { ReplayImportJobStore } from './data/import/replay-import-job.store';
import { NAV_ITEMS, Shell } from './shell/shell';

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

  it('renders the brand, one nav link per section, and the platform badge', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.shell__toolbar-title')?.textContent).toContain('Heroes Replay Stats');
    const links = [...el.querySelectorAll('mat-nav-list a[mat-list-item]')].map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(NAV_ITEMS.map((i) => i.path));
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

  it('puts the app pages in the shell and the Play screen background on a page of its own', () => {
    const shell = routes.find((r) => r.component === Shell);
    expect(shell?.children?.map((r) => r.path)).toContain('replays');
    expect(routes.some((r) => r.matcher === editBackgroundMatcher)).toBe(true);
    expect(shell?.children?.map((r) => r.path)).not.toContain('edit-background');
  });

  it('takes the Background page with what it has open in its path', () => {
    const at = (path: string) =>
      editBackgroundMatcher(path.split('/').map((p) => new UrlSegment(p, {})));
    expect(at('edit-background')?.posParams).toBeUndefined();
    expect(at('edit-background')?.consumed).toHaveLength(1);
    const open = at('edit-background/material/edgeLight222-korhal')?.posParams;
    expect([open?.['kind']?.path, open?.['id']?.path]).toEqual(['material', 'edgeLight222-korhal']);
    expect(at('edit-background/planet')).toBeNull();
    const library = at('edit-background/library/planets/korhal')?.posParams;
    expect([library?.['library']?.path, library?.['item']?.path]).toEqual(['planets', 'korhal']);
    expect(at('edit-background/library/planets')?.posParams?.['kind']).toBeUndefined();
    expect(at('edit-background/library/planets/korhal/x')).toBeNull();
    expect(at('play-background')).toBeNull();
    expect(at('replays')).toBeNull();
  });
});
