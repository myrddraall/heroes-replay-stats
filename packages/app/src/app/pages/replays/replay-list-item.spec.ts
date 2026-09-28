import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { ReplaySummary } from '../../data/replays/replay.service';
import { SettingsStore } from '../../data/settings/settings.store';
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
      toonHandle: '1-Hero-1-1',
      name: 'Alice',
      hero: 'Sonya',
      heroId: 'Barbarian',
      team: 0,
      won: false,
      kind: 'player',
    },
    {
      slot: 5,
      toonHandle: '1-Hero-1-5',
      name: 'Bob',
      hero: 'Jaina',
      heroId: 'Jaina',
      team: 1,
      won: true,
      kind: 'player',
    },
  ],
  recorderToonHandle: '1-Hero-1-5',
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
    // Bob recorded it, so his team is blue and listed first
    expect(teams).toEqual([
      ['Victory', [['Jaina', 'Bob']]],
      ['Defeat', [['Sonya', 'Alice']]],
    ]);
    expect(el.querySelectorAll('.team')[0]!.classList).toContain('team--won');
  });

  it("colours the teams from the recorder's point of view, or yours once marked", async () => {
    localStorage.clear();
    const fixture = TestBed.createComponent(ReplayListItem);
    fixture.componentRef.setInput('replay', replay);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const rows = () =>
      [...el.querySelectorAll('.team')].map((t) => [
        t.querySelector('.team__name')!.firstChild!.textContent!.trim(),
        t.classList.contains('hrs-team-blue') ? 'blue' : 'red',
      ]);
    // Bob recorded it, so his team (1) is blue, and blue is on top
    expect(rows()).toEqual([
      ['Blue team', 'blue'],
      ['Red team', 'red'],
    ]);

    TestBed.inject(SettingsStore).setMe('1-Hero-1-1', true);
    await fixture.whenStable();
    expect(rows()).toEqual([
      ['Blue team', 'blue'],
      ['Red team', 'red'],
    ]);
    localStorage.clear();
  });

  it('lists you first on your team, then the rest in slot order', async () => {
    localStorage.clear();
    const [alice, bob] = replay.players;
    const fixture = TestBed.createComponent(ReplayListItem);
    fixture.componentRef.setInput('replay', {
      ...replay,
      players: [
        alice!,
        { ...alice!, slot: 1, toonHandle: '1-Hero-1-2', name: 'Carol', hero: 'Raynor' },
        { ...alice!, slot: 2, toonHandle: '1-Hero-1-3', name: 'Dave', hero: 'Muradin' },
        bob!,
      ],
      recorderToonHandle: '1-Hero-1-3',
    });
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const names = [...el.querySelectorAll('.team')].map((t) =>
      [...t.querySelectorAll('.player__name')].map((n) => n.textContent!.trim()),
    );
    expect(names).toEqual([['Dave', 'Alice', 'Carol'], ['Bob']]);
  });
});
