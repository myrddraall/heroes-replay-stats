import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePreviewPage } from './theme-preview-page';

describe('ThemePreviewPage', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  async function render() {
    // The background's scene isn't served here: it stays black, as it does when it can't load.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('not in this test'));
    const fixture = TestBed.createComponent(ThemePreviewPage);
    await fixture.whenStable();
    return fixture;
  }

  it('shows a panel in each theme, and the teams mixed in a neutral panel', async () => {
    const el: HTMLElement = (await render()).nativeElement;
    const panels = [...el.querySelectorAll('.variants .hrs-panel')];
    expect(panels.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Purple',
      'Magenta',
      'Cyan',
      'Blue team',
      'Red team',
    ]);
    expect(panels.map((p) => p.getAttribute('data-theme'))).toEqual([
      'purple',
      'magenta',
      'cyan',
      'blue',
      'red',
    ]);
    const tables = [...el.querySelectorAll('.match table')];
    expect(tables.map((t) => t.getAttribute('data-theme'))).toEqual(['blue', 'red']);
  });
});
