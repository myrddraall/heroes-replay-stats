import type { HeroInfo, TalentInfo } from '@myrddraall/hero-data';
import type { TalentPickRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { talentRows } from './talent-rows';

describe('talent rows', () => {
  const players = [
    {
      slot: 0,
      name: 'Ann',
      hero: 'Valla',
      heroId: 'Valla',
      team: 0 as const,
      silenced: false,
      voiceSilenced: false,
    },
    {
      slot: 5,
      name: 'Bob',
      hero: 'Muradin',
      heroId: 'Muradin',
      team: 1 as const,
      silenced: true,
      voiceSilenced: false,
    },
  ];
  const pick = (slot: number, tier: number, talent: string): TalentPickRow => ({
    slot,
    name: '',
    hero: '',
    heroId: '',
    team: 0,
    won: null,
    tier,
    level: tier,
    talent,
    seconds: 0,
    gameloop: 0,
  });
  const known = {
    id: 'Valla1',
    name: 'Hungering Arrow+',
    icon: 'valla1.png',
    level: 1,
    sort: 2,
    abilityType: 'W',
    fullText: 'Arrows <c val="bfd4fd">hunger</c>.',
  } as TalentInfo;
  const heroic = (id: string, level: number) =>
    ({ id, level, abilityType: 'Heroic' }) as TalentInfo;
  const plain = (id: string, level: number) => ({ id, level, abilityType: 'Q' }) as TalentInfo;
  const valla = {
    id: 'DemonHunter',
    talents: [
      known,
      plain('Valla4', 4),
      plain('Valla7', 7),
      heroic('Valla10a', 10),
      heroic('Valla10b', 10),
      heroic('Valla20a', 20),
      plain('Valla20b', 20),
    ],
  } as Pick<HeroInfo, 'id' | 'talents'> as HeroInfo;
  // a heroic tier only partly typed heroic (Deathwing's level 10), and a stray heroic-typed talent
  const deathwing = {
    id: 'Deathwing',
    talents: [
      plain('Dw1', 1),
      heroic('Dw4Stray', 4),
      plain('Dw4', 4),
      plain('Dw4b', 4),
      plain('Dw7', 7),
      heroic('Dw10Burn', 10),
      { id: 'Dw10Roar', level: 10, abilityType: 'Active' } as TalentInfo,
      heroic('Dw20', 20),
    ],
  } as Pick<HeroInfo, 'id' | 'talents'> as HeroInfo;
  const data = {
    hero: (id: string) => (id === 'Valla' ? valla : id === 'Deathwing' ? deathwing : undefined),
    talent: (id: string) => (id === known.id ? known : undefined),
  };
  const images = { icon: (t: TalentInfo) => ({ src: `img/${t.icon}` }) };

  it("puts each pick under its tier, named and pictured from the data, else by the game's id", () => {
    const rows = talentRows(
      players,
      [pick(0, 1, 'Valla1'), pick(0, 3, 'ValllaUnknown')],
      {},
      data,
      images,
      0,
      'relative',
    );
    expect(rows[0]!.tiers.map((t) => t.talent)).toEqual([
      {
        name: 'Hungering Arrow+',
        level: 1,
        icon: { src: 'img/valla1.png' },
        text: 'Arrows <c val="bfd4fd">hunger</c>.',
      },
      null,
      { name: 'ValllaUnknown', level: 3, icon: null, text: null },
      null,
      null,
      null,
      null,
    ]);
  });

  it('puts your team first, themed blue, and names talents by id before the data loads', () => {
    const rows = talentRows(players, [pick(5, 1, 'Valla1')], {}, null, images, 1, 'relative');
    expect(rows.map((r) => [r.key, r.theme])).toEqual([
      [5, 'blue'],
      [0, 'red'],
    ]);
    expect(rows[0]!.tiers[0]!.talent).toEqual({ name: 'Valla1', level: 1, icon: null, text: null });
  });

  it("gives your own rows your side's self theme, with each player's portrait", () => {
    const portrait = { name: 'Muradin', picture: { src: 'img/muradin.png' } };
    const rows = talentRows(
      players,
      [],
      { 5: portrait },
      null,
      images,
      1,
      'relative',
      new Set([5]),
    );
    expect(rows.map((r) => [r.key, r.theme, r.portrait])).toEqual([
      [5, 'blue-self', portrait],
      [0, 'red', null],
    ]);
  });

  it("marks the hero's heroic tier, picked or not; none before the data loads", () => {
    const tiers = (d: typeof data | null) =>
      talentRows(players, [], {}, d, images, 0, 'relative')[0]!.tiers.map((t) => t.heroic);
    expect(tiers(data)).toEqual([false, false, false, true, false, false, false]);
    expect(tiers(null)).toEqual([false, false, false, false, false, false, false]);
  });

  it('marks the tier most typed heroic: a mixed one (Deathwing), not a stray heroic talent', () => {
    const dw = [{ ...players[0]!, heroId: 'Deathwing', hero: 'Deathwing' }];
    const tiers = talentRows(dw, [], {}, data, images, 0, 'relative')[0]!.tiers.map(
      (t) => t.heroic,
    );
    expect(tiers.slice(0, 4)).toEqual([false, false, false, true]);
  });

  it("links each build as the game does, each tier's place from the data; none it can't place", () => {
    const build = (d: typeof data | null, picks: TalentPickRow[]) =>
      talentRows(players, picks, {}, d, images, 0, 'relative')[0]!.build;
    expect(build(data, [pick(0, 1, 'Valla1')])).toBe('[T2000000,DemonHunter]');
    expect(build(data, [pick(0, 1, 'Valla1'), pick(0, 2, 'NotInTheData')])).toBeNull();
    expect(build(data, [])).toBeNull();
    expect(build(null, [pick(0, 1, 'Valla1')])).toBeNull();
  });
});
