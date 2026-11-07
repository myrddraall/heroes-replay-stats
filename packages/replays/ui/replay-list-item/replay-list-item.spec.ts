import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { heroesImages } from '@myrddraall/hero-data';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fakeHeroData } from '@myrddraall/heroes-replay-stats-heroes/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { heroLookup, type HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { ReplaySummary } from '../../model';
import { toReplayCard, type ReplayCard, type ReplayCardJob } from './replay-card';
import { formatDuration, ReplayListItem } from './replay-list-item';

const replay: ReplaySummary = {
  id: 'r1',
  map: 'Towers of Doom',
  mode: 'storm-league',
  playedAt: '2024-06-01T18:30:00.000Z',
  importedAt: '2024-06-02T09:15:00.000Z',
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
  outdated: false,
};

let heroes: HeroLookup;

/** The item showing a replay's card, for the accounts marked as me, already viewed. */
async function render(r: ReplaySummary, me: readonly string[] = []) {
  return renderCard(toReplayCard(r, new Set(me), heroes, r.importedAt));
}

async function renderCard(card: ReplayCard) {
  const fixture = TestBed.createComponent(ReplayListItem);
  fixture.componentRef.setInput('card', card);
  await fixture.whenStable();
  return fixture;
}

describe('ReplayListItem', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideFakeSheets()] }),
  );

  beforeAll(async () => {
    heroes = heroLookup(await fakeHeroData.latest(), heroesImages());
  });

  it('formats durations as m:ss, and h:mm:ss past an hour', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1234)).toBe('20:34');
    // before the game's clock started: pre-game chat
    expect(formatDuration(-21.4)).toBe('-0:21');
    expect(formatDuration(-0.3)).toBe('0:00');
    expect(formatDuration(3725.4)).toBe('1:02:05');
  });

  it('shows map, mode, length, build, dates and each team with its result and heroes', async () => {
    const fixture = await render(replay);
    const el: HTMLElement = fixture.nativeElement;
    const text = (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();

    expect(text('.replay__map')).toBe('Towers of Doom');
    expect(text('.replay__mode')).toBe('Storm League');
    expect(text('.replay__length')).toBe('20:34');
    expect(text('.replay__activity')).toBe('analysing…'); // ready: its background analysers run
    expect(el.querySelector('.replay__played time')?.getAttribute('datetime')).toBe(
      replay.playedAt,
    );
    expect(text('.replay__played')).toMatch(/^Played: Jun [12], 2024, \d\d:30 · Build: 85267$/);
    expect(el.querySelector('.replay__imported time')?.getAttribute('datetime')).toBe(
      replay.importedAt,
    );
    expect(text('.replay__imported')).toMatch(/^Imported: Jun 2, 2024, \d\d:15$/);
    const t = (node: Element, sel: string) => node.querySelector(sel)?.textContent?.trim();
    const teams = [...el.querySelectorAll('hrs-match-team')].map((team) => [
      t(team, '.result'),
      [...team.querySelectorAll('hrs-player-cell')].map((p) => [
        t(p, '.cell__hero'),
        t(p, '.cell__player'),
      ]),
    ]);
    // Bob recorded it, so his team is blue and listed first
    expect(teams).toEqual([
      ['Victory', [['Jaina', 'Bob']]],
      ['Defeat', [['Sonya', 'Alice']]],
    ]);
    // Victory glows in the legendary theme, Defeat is plain in the team's colour
    const results = [...el.querySelectorAll('.result > span')].map((r) => [
      r.className.match(/hrs-styled--(\w+)/)?.[1],
      r.getAttribute('theme'),
    ]);
    expect(results).toEqual([
      ['glow', 'legendary'],
      ['base', null],
    ]);
    // each player has their hero's minimap icon; Sonya is the only hero the fake data knows
    const icons = [...el.querySelectorAll('hrs-player-cell')].map((p) => [
      p.querySelector('hrs-hero-minimap-icon') !== null,
      p.querySelector<HTMLImageElement>('hrs-hero-minimap-icon .icon img')?.alt,
    ]);
    expect(icons).toEqual([
      [true, undefined],
      [true, 'Sonya'],
    ]);
    // the map's replay preview sits behind the card, decorative
    const preview = el.querySelector<HTMLImageElement>('.replay__preview img');
    expect(preview?.getAttribute('src')).toBe(
      'https://raw.githubusercontent.com/HeroesToolChest/heroes-images/main/heroesimages/replaypreviews/replayspreviewimage_towersofdoom.png',
    );
    expect(preview?.alt).toBe('');
  });

  it('has no preview for a map the data does not know', async () => {
    const fixture = await render({ ...replay, map: 'Nowhere' });
    expect(fixture.nativeElement.querySelector('.replay__preview')).toBeNull();
  });

  it("colours the teams from the recorder's point of view, or yours once marked", async () => {
    const rows = (el: HTMLElement) =>
      [...el.querySelectorAll('hrs-match-team')].map((t) => [
        t.getAttribute('aria-label'),
        t.getAttribute('theme'),
        t.querySelector('.cell__player')!.textContent!.trim(),
      ]);
    // Bob recorded it, so his team (1) is blue, and blue is on top
    expect(rows((await render(replay)).nativeElement)).toEqual([
      ['Blue team', 'blue', 'Bob'],
      ['Red team', 'red', 'Alice'],
    ]);
    // Alice marked as me: her team is blue now
    expect(rows((await render(replay, ['1-Hero-1-1'])).nativeElement)).toEqual([
      ['Blue team', 'blue', 'Alice'],
      ['Red team', 'red', 'Bob'],
    ]);
  });

  it('lists you first on your team, then the rest in slot order', async () => {
    const [alice, bob] = replay.players;
    const fixture = await render({
      ...replay,
      players: [
        alice!,
        { ...alice!, slot: 1, toonHandle: '1-Hero-1-2', name: 'Carol', hero: 'Raynor' },
        { ...alice!, slot: 2, toonHandle: '1-Hero-1-3', name: 'Dave', hero: 'Muradin' },
        bob!,
      ],
      recorderToonHandle: '1-Hero-1-3',
    });
    const el: HTMLElement = fixture.nativeElement;
    const names = [...el.querySelectorAll('hrs-match-team')].map((t) =>
      [...t.querySelectorAll('.cell__player')].map((n) => n.textContent!.trim()),
    );
    expect(names).toEqual([['Dave', 'Alice', 'Carol'], ['Bob']]);
  });

  it('marks a match new until opened, updated once imported again, and one out of date', async () => {
    const marks = async (r: ReplaySummary, seen: string | undefined) =>
      [
        ...(
          await renderCard(toReplayCard(r, new Set(), heroes, seen))
        ).nativeElement.querySelectorAll('mat-chip'),
      ].map((c) => (c as HTMLElement).textContent!.trim());
    expect(await marks(replay, replay.importedAt)).toEqual([]);
    expect(await marks(replay, undefined)).toEqual(['New']);
    expect(await marks(replay, '2024-06-01T00:00:00.000Z')).toEqual(['Updated']);
    expect(await marks({ ...replay, outdated: true }, replay.importedAt)).toEqual(['Out of date']);
    expect(await marks({ ...replay, outdated: true }, undefined)).toEqual(['New', 'Out of date']);
  });

  it('shows you in your own theme on your side, and says so to screen readers', async () => {
    const you = (el: HTMLElement) =>
      [...el.querySelectorAll('hrs-player-cell')].map((p) => [
        p.querySelector('.cell__player')!.textContent!.trim(),
        p.getAttribute('theme'),
        p.querySelector('.cell__you')?.textContent?.trim() ?? null,
      ]);
    // Bob recorded it
    expect(you((await render(replay)).nativeElement)).toEqual([
      ['Bob', 'blue-self', '(you)'],
      ['Alice', 'red', null],
    ]);
    expect(you((await render(replay, ['1-Hero-1-1'])).nativeElement)).toEqual([
      ['Alice', 'blue-self', '(you)'],
      ['Bob', 'red', null],
    ]);
  });

  it('says when there is no result, nobody on a side, or no game clock yet', async () => {
    const [alice] = replay.players;
    // left during loading: no winner, the gates never opened, and only Alice on her side
    const fixture = await render({
      ...replay,
      winningTeam: null,
      durationSeconds: 0,
      players: [alice!],
      recorderToonHandle: alice!.toonHandle,
    });
    const el: HTMLElement = fixture.nativeElement;
    const t = (node: ParentNode, sel: string) => node.querySelector(sel)?.textContent?.trim();
    expect(t(el, '.replay__length')).toBe('Before the gates opened');
    const teams = [...el.querySelectorAll('hrs-match-team')].map((team) => [
      team.getAttribute('aria-label'),
      t(team, '.result'),
      team.querySelector('[hrsStyledText], .hrs-styled--glow, .hrs-styled--base') !== null,
      t(team, '.empty') ?? null,
      team.querySelectorAll('hrs-player-cell').length,
    ]);
    expect(teams).toEqual([
      ['Blue team', 'No result', false, null, 1],
      ['Red team', 'No result', false, 'No players', 0],
    ]);
  });

  it('shows an import and its analysers in progress, after the chips, and opens once imported', async () => {
    const state = async (r: ReplaySummary, job: ReplayCardJob | null) => {
      const el: HTMLElement = (await renderCard(toReplayCard(r, new Set(), heroes, undefined, job)))
        .nativeElement;
      const head = [...el.querySelector('.replay__head')!.children].map((c) => c.className);
      return {
        activity: el.querySelector('.replay__activity')?.textContent?.trim() ?? null,
        afterChips:
          head.indexOf('replay__activity') ===
          head.findIndex((c) => c.includes('replay__marks')) + 1,
        bar: el.querySelector('mat-progress-bar')?.getAttribute('aria-valuenow') ?? null,
        label: el.querySelector('mat-progress-bar')?.getAttribute('aria-label') ?? null,
        opens: el.querySelector('.replay__link') !== null,
      };
    };
    const importing = { stage: 'importing', progress: 0.42 } as const;
    expect(await state({ ...replay, status: 'ingesting' }, importing)).toEqual({
      activity: 'importing…',
      afterChips: true,
      bar: '42',
      label: 'Importing Towers of Doom',
      opens: false,
    });
    // re-imported: still listed as ready, but its job is importing it again
    expect((await state({ ...replay, status: 'complete' }, importing)).opens).toBe(false);
    expect(await state(replay, { stage: 'analysing', progress: 0.9 })).toEqual({
      activity: 'analysing…',
      afterChips: true,
      bar: '90',
      label: 'Analysing Towers of Doom',
      opens: true,
    });
    // a job's start, 0%, still shows its bar
    expect((await state(replay, { stage: 'analysing', progress: 0 })).bar).toBe('0');
    // without a job, from its stored status: ready is analysing, without progress
    expect(await state(replay, null)).toMatchObject({
      activity: 'analysing…',
      bar: null,
      opens: true,
    });
    expect(await state({ ...replay, status: 'complete' }, null)).toMatchObject({
      activity: null,
      bar: null,
      opens: true,
    });
  });
});
