import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ReplaySummary } from '../../data/replays/replay.service';
import { formatDuration, ReplayListItem } from './replay-list-item';

const replay: ReplaySummary = {
  id: 'r1',
  map: 'Towers of Doom',
  mode: 'storm-league',
  playedAt: '2024-06-01T18:30:00.000Z',
  durationSeconds: 1234,
  winningTeam: 1,
  build: 85267,
  status: 'ready',
  players: [
    {
      slot: 0,
      name: 'Alice',
      hero: 'Sonya',
      heroId: 'Barbarian',
      team: 0,
      won: false,
      kind: 'player',
    },
    { slot: 5, name: 'Bob', hero: 'Jaina', heroId: 'Jaina', team: 1, won: true, kind: 'player' },
  ],
};

describe('ReplayListItem', () => {
  it('formats durations as m:ss, and h:mm:ss past an hour', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1234)).toBe('20:34');
    expect(formatDuration(3725.4)).toBe('1:02:05');
  });

  it('shows map, mode, duration, build and each team with its result and heroes', async () => {
    const fixture = TestBed.createComponent(ReplayListItem);
    fixture.componentRef.setInput('replay', replay);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();

    expect(text('.replay__map')).toBe('Towers of Doom');
    expect(text('.replay__mode')).toBe('Storm League');
    expect(text('.replay__meta')).toBe('20:34 · build 85267 · analysing…');
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe(replay.playedAt);
    const t = (node: Element, sel: string) => node.querySelector(sel)?.textContent?.trim();
    const teams = [...el.querySelectorAll('.team')].map((team) => [
      t(team, '.team__result'),
      [...team.querySelectorAll('.player')].map((p) => [
        t(p, '.player__hero'),
        t(p, '.player__name'),
      ]),
    ]);
    expect(teams).toEqual([
      ['Defeat', [['Sonya', 'Alice']]],
      ['Victory', [['Jaina', 'Bob']]],
    ]);
    expect(el.querySelector('.team--1')!.classList).toContain('team--won');
  });
});
