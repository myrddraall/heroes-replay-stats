import type { HeroInfo, TalentInfo } from '@myrddraall/hero-data';
import type { TalentPickRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { talentRows } from './talent-rows';

describe('talent rows', () => {
  const players = [
    { slot: 0, name: 'Ann', hero: 'Valla', heroId: 'Valla', team: 0 as const, silenced: false, voiceSilenced: false },
    { slot: 5, name: 'Bob', hero: 'Muradin', heroId: 'Muradin', team: 1 as const, silenced: true, voiceSilenced: false },
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
    abilityType: 'W',
  } as TalentInfo;
  const heroic = (id: string, level: number) => ({ id, level, abilityType: 'Heroic' }) as TalentInfo;
  const plain = (id: string, level: number) => ({ id, level, abilityType: 'Q' }) as TalentInfo;
  const valla = {
    talents: [
      known,
      plain('Valla4', 4),
      plain('Valla7', 7),
      heroic('Valla10a', 10),
      heroic('Valla10b', 10),
      heroic('Valla20a', 20),
      plain('Valla20b', 20),
    ],
  } as Pick<HeroInfo, 'talents'> as HeroInfo;
  const data = {
    hero: (id: string) => (id === 'Valla' ? valla : undefined),
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
      { name: 'Hungering Arrow+', level: 1, icon: { src: 'img/valla1.png' } },
      null,
      { name: 'ValllaUnknown', level: 3, icon: null },
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
    expect(rows[0]!.tiers[0]!.talent).toEqual({ name: 'Valla1', level: 1, icon: null });
  });

  it("gives your own rows your side's self theme, with each player's portrait", () => {
    const portrait = { name: 'Muradin', picture: { src: 'img/muradin.png' } };
    const rows = talentRows(players, [], { 5: portrait }, null, images, 1, 'relative', new Set([5]));
    expect(rows.map((r) => [r.key, r.theme, r.portrait])).toEqual([
      [5, 'blue-self', portrait],
      [0, 'red', null],
    ]);
  });

  it("marks the tier where all the hero's talents are heroics, picked or not; none before the data loads", () => {
    const tiers = (d: typeof data | null) =>
      talentRows(players, [], {}, d, images, 0, 'relative')[0]!.tiers.map((t) => t.heroic);
    expect(tiers(data)).toEqual([false, false, false, true, false, false, false]);
    expect(tiers(null)).toEqual([false, false, false, false, false, false, false]);
  });
});
