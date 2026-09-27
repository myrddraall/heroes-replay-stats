import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { REPLAY_DB } from './data/import/provide-replay-db';
import { PLATFORM, type Platform } from './platform/platform';
import { ReplayImportJobStore } from './data/import/replay-import-job.store';
import { NAV_ITEMS } from './shell/shell';

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
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: PLATFORM, useValue: fakePlatform },
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
    const fixture = TestBed.createComponent(App);
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
    const fixture = TestBed.createComponent(App);
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
});
