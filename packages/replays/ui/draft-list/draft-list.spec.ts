import { TestBed } from '@angular/core/testing';
import { provideWholeLists } from '@myrddraall/heroes-replay-stats-data-views/testing';
import { describe, expect, it } from 'vitest';
import { DraftList } from './draft-list';
import type { DraftStep } from './draft-steps';

const steps: readonly DraftStep[] = [
  { key: 1, order: 1, action: 'Ban', team: 0, teamName: 'Blue team', hero: 'Genji', icon: null, player: null },
  { key: 2, order: 2, action: 'Pick', team: 1, teamName: 'Red team', hero: 'Li Li', icon: null, player: 'Ann' },
];

describe('DraftList', () => {
  it('draws a row per step in its team colour, the hero naming the row, a ban quieter', async () => {
    TestBed.configureTestingModule({ providers: [provideWholeLists()] });
    const fixture = TestBed.createComponent(DraftList);
    fixture.componentRef.setInput('steps', steps);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('.hrs-grid__body [role="row"]')];
    expect(rows.map((r) => [...r.children].map((c) => c.textContent!.trim()))).toEqual([
      ['1', 'Blue team', 'Ban', 'Genji', ''],
      ['2', 'Red team', 'Pick', 'Li Li', 'Ann'],
    ]);
    expect(rows.map((r) => r.getAttribute('theme'))).toEqual(['blue', 'red']);
    expect([...rows[0]!.children].map((c) => c.getAttribute('role'))).toEqual(['cell', 'cell', 'cell', 'rowheader', 'cell']);
    expect(rows[0]!.querySelector('.step__hero')!.classList.contains('step--ban')).toBe(true);
    expect(rows[1]!.querySelector('.step__hero')!.classList.contains('step--ban')).toBe(false);
  });
});
