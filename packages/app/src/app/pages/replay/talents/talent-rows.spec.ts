import type { TalentInfo } from '@myrddraall/hero-data';
import type { TalentPickRow } from '@myrddraall/heroprotocol-analysis';
import { describe, expect, it } from 'vitest';
import { talentRows } from './talent-rows';

describe('talent rows', () => {
  const players = [
    { slot: 0, name: 'Ann', hero: 'Valla', team: 0 as const },
    { slot: 5, name: 'Bob', hero: 'Muradin', team: 1 as const },
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
  } as TalentInfo;
  const data = { talent: (id: string) => (id === known.id ? known : undefined) };
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
    expect(rows[0]!.talents).toEqual([
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
    expect(rows.map((r) => [r.key, r.class])).toEqual([
      [5, 'hrs-glass-blue'],
      [0, 'hrs-glass-red'],
    ]);
    expect(rows[0]!.talents[0]).toEqual({ name: 'Valla1', level: 1, icon: null });
  });
});
