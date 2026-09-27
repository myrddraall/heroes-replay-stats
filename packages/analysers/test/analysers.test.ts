import { beforeAll, describe, expect, it } from 'vitest';
import { createRegistry, type NormalizedReplay } from '@myrddraall/heroprotocol-db';
import { analysers, type PointOfInterestRow, type TimelineEventRow } from '../src/index.js';
import { goldenFor, localReplays, normalizeLocal, runInMemory, stable } from './util.js';

const replays = localReplays();
const fixtures = new Map<string, NormalizedReplay>();

beforeAll(async () => {
  for (const f of replays) fixtures.set(f, await normalizeLocal(f));
});

describe('registry', () => {
  it('registers both analysers with valid, replayId-first tables', () => {
    const reg = createRegistry(analysers);
    expect(() => reg.validate()).not.toThrow();
    expect(reg.list().map((r) => [r.analyser.id, r.mode])).toEqual([
      ['@myrddraall/timeline', 'background'],
      ['@myrddraall/points-of-interest', 'background'],
    ]);
    expect(Object.keys(reg.tables()).sort()).toEqual([
      'mapInfo',
      'pointsOfInterest',
      'timelineEvents',
    ]);
  });
});

describe.skipIf(replays.length === 0)('on real replays', () => {
  describe.each(replays)('%s', (file) => {
    it('match the committed golden', async () => {
      const golden = goldenFor(file);
      expect(
        golden,
        'no golden committed — run `pnpm run generate.analysis-goldens`',
      ).toBeDefined();
      expect(stable(await runInMemory(fixtures.get(file)!))).toEqual(golden);
    });

    it('hold the invariants the 2018 viewer relied on, without its bugs', async () => {
      const f = fixtures.get(file)!;
      const r = await runInMemory(f);
      const tl = r['@myrddraall/timeline']!['timelineEvents'] as TimelineEventRow[];
      const poi = r['@myrddraall/points-of-interest']!['pointsOfInterest'] as PointOfInterestRow[];
      const players = f.players.filter((p) => p.kind !== 'observer');

      // level events once each with numeric levels, talents with names, spans tile the game
      const levels = tl.filter((e) => e.kind === 'level');
      expect(levels).toHaveLength(f.statEvents.filter((s) => s.eventName === 'LevelUp').length);
      expect(levels.every((e) => (e.level ?? 0) > 0)).toBe(true);
      const talentEvents = tl.filter((e) => e.kind === 'talent');
      expect(talentEvents.length).toBe(players.reduce((a, p) => a + p.talents.length, 0));
      expect(talentEvents.every((e) => (e.talent ?? '').length > 0 && (e.level ?? 0) > 0)).toBe(
        true,
      );
      for (const p of players) {
        const spans = tl.filter(
          (e) => (e.kind === 'alive' || e.kind === 'dead') && e.slot === p.slot,
        );
        expect(spans[0]!.start).toBe(0);
        expect(spans.at(-1)!.end).toBe(f.replay.durationLoops);
        for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBe(spans[i - 1]!.end);
      }
      expect(tl.filter((e) => e.kind === 'death')).toHaveLength(
        f.statEvents.filter((s) => s.eventName === 'PlayerDeath').length,
      );
      expect(tl.filter((e) => e.kind === 'core-death')).toHaveLength(1);
      for (let i = 1; i < tl.length; i++)
        expect(tl[i]!.start).toBeGreaterThanOrEqual(tl[i - 1]!.start);
      expect(tl.map((e) => e.seq)).toEqual(tl.map((_, i) => i));

      // points of interest include the two cores
      expect(poi.filter((p) => p.type === 'core')).toHaveLength(2);
    });
  });
});
