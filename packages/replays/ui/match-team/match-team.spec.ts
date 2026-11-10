import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MatchTeam, type MatchTeamPlayer } from './match-team';

const player = (slot: number, hero: string, name: string, you = false): MatchTeamPlayer => ({
  slot,
  hero,
  name,
  icon: null,
  you,
});

describe('MatchTeam', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  async function render(won: boolean | null, players: readonly MatchTeamPlayer[]) {
    const fixture = TestBed.createComponent(MatchTeam);
    fixture.componentRef.setInput('team', 1);
    fixture.componentRef.setInput('name', 'Red team');
    fixture.componentRef.setInput('won', won);
    fixture.componentRef.setInput('players', players);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it("is a group named for its side, in its team's theme, each player in theirs", async () => {
    const el = await render(true, [player(0, 'Jaina', 'Bob', true), player(1, 'Sonya', 'Alice')]);
    expect([el.getAttribute('role'), el.getAttribute('aria-label'), el.getAttribute('theme')]).toEqual([
      'group',
      'Red team',
      'red',
    ]);
    expect(el.querySelector('.result')!.textContent!.trim()).toBe('Victory');
    expect(
      [...el.querySelectorAll('hrs-player-cell')].map((p) => [
        p.querySelector('.cell__player')!.textContent,
        p.getAttribute('theme'),
      ]),
    ).toEqual([
      ['Bob', 'red-self'],
      ['Alice', 'red'],
    ]);
  });

  it('says when there is no result or nobody on the side', async () => {
    const el = await render(null, []);
    expect(el.querySelector('.result')!.textContent!.trim()).toBe('No result');
    expect(el.querySelector('.empty')!.textContent).toBe('No players');
  });
});
