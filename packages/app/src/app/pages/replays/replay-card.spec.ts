import { describe, expect, it } from 'vitest';
import type { HeroLookup } from '../../data/heroes/hero-lookup';
import type { ReplaySummary } from '../../data/replays/replay.service';
import { toReplayCard } from './replay-card';

const player = (slot: number, team: 0 | 1, toonHandle: string, heroId: string) => ({
  slot,
  toonHandle,
  name: toonHandle,
  hero: heroId,
  heroId,
  team,
  won: team === 1,
  kind: 'player' as const,
});

const replay: ReplaySummary = {
  id: 'r1',
  map: 'Towers of Doom',
  mode: 'storm-league',
  playedAt: '2024-06-01T18:30:00.000Z',
  importedAt: '2024-06-02T09:15:00.000Z',
  durationSeconds: 1234,
  winningTeam: 1,
  build: 85267,
  status: 'complete',
  players: [player(0, 0, 'a', 'Barbarian'), player(5, 1, 'b', 'Jaina')],
  recorderToonHandle: 'b',
};

const heroes: HeroLookup = {
  heroIcon: (id) => (id === 'Barbarian' ? { src: 'sonya.png', name: 'Sonya' } : null),
  mapPreview: (map) => (map === 'Towers of Doom' ? 'towers.png' : null),
};

describe('toReplayCard', () => {
  it("resolves you: the recorder, or your account once it's marked as me", () => {
    expect(toReplayCard(replay, new Set(), heroes).you).toEqual({ slots: [5], team: 1 });
    expect(toReplayCard(replay, new Set(['a']), heroes).you).toEqual({ slots: [0], team: 0 });
  });

  it("gives the map's preview and each player's hero icon, by slot", () => {
    const card = toReplayCard(replay, new Set(), heroes);
    expect(card.preview).toBe('towers.png');
    expect(card.icons).toEqual({ 0: { src: 'sonya.png', name: 'Sonya' }, 5: null });
    expect(card.replay).toBe(replay);
  });
});
