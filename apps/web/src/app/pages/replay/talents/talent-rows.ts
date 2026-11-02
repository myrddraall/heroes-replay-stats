import type { HeroDataSet, HeroesImages, Picture } from '@myrddraall/hero-data';
import type { TalentPickRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { TeamColorMode } from '../../../team/team-color';
import { type PlayerIdentity, playerRows } from '../player-rows';

/**
 * The talent tiers, in order. The level a tier opens at differs by hero (Chromie's open earlier),
 * so the table heads its columns by tier and shows each pick's own level.
 */
export const TALENT_TIERS = [1, 2, 3, 4, 5, 6, 7] as const;

/** A talent a player picked, as the talents table shows it. */
export interface TalentCell {
  readonly name: string;
  /** The level the player had when they picked it. */
  readonly level: number;
  /** The talent's icon; null when the hero data has none. */
  readonly icon: Picture | null;
}

/** One player's row of the talents table. */
export interface TalentRow {
  readonly key: number;
  readonly player: PlayerIdentity;
  readonly icon: HeroIcon | null;
  /** The team's theme class, such as `hrs-glass-blue`. */
  readonly class: string | undefined;
  /** By tier, in {@link TALENT_TIERS}' order; null for a tier not picked. */
  readonly talents: readonly (TalentCell | null)[];
}

/**
 * Each player's talents by tier, grouped by team and themed in its colour from your point of
 * view (your team first, then by slot), named and pictured from the hero data where it knows the
 * talent and by the game's own id otherwise.
 */
export function talentRows(
  players: readonly PlayerIdentity[],
  picks: readonly TalentPickRow[],
  icons: Readonly<Record<number, HeroIcon | null>>,
  data: Pick<HeroDataSet, 'talent'> | null,
  images: Pick<HeroesImages, 'icon'>,
  yourTeam: Team | null,
  mode: TeamColorMode,
): TalentRow[] {
  const cell = (pick: TalentPickRow): TalentCell => {
    const info = data?.talent(pick.talent);
    return {
      name: info?.name ?? pick.talent,
      level: pick.level,
      icon: info ? images.icon(info) : null,
    };
  };
  return playerRows(players, icons, [], yourTeam, mode).map((row) => {
    const own = picks.filter((p) => p.slot === row.data.player.slot);
    return {
      key: row.data.player.slot,
      player: row.data.player,
      icon: row.data.icon,
      class: row.class,
      talents: TALENT_TIERS.map((tier) => {
        const pick = own.find((p) => p.tier === tier);
        return pick ? cell(pick) : null;
      }),
    };
  });
}
