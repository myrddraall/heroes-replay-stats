import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';
import { PLATFORM, type Platform } from './platform/platform';
import { NAV_ITEMS } from './shell/shell';

const fakePlatform: Platform = {
  kind: 'web',
  version: 'test',
  pickReplays: async () => [],
  defaultReplayDirectory: async () => undefined,
};

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: PLATFORM, useValue: fakePlatform }],
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
});
