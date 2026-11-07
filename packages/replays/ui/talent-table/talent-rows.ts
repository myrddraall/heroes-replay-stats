import type { HeroDataSet, HeroesImages, Picture } from '@myrddraall/hero-data';
import type { TalentPickRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { StatRowTheme, TeamColorMode } from '../../model';
import { type PlayerIdentity, playerRows } from '../stat-tables/player-rows';

/**
 * The talent tiers, in order. The level a tier opens at differs by hero (Chromie's open earlier).
 */
export const TALENT_TIERS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * The levels the tiers open at for most heroes, as the game's talent screen heads its columns
 * (TalentTierLabel); each pick's tooltip says its own level.
 */
export const TALENT_TIER_LEVELS = [1, 4, 7, 10, 13, 16, 20] as const;

/** The heroic tier for all heroes but Varian (level 4) and Deathwing (none): level 10's. */
export const HEROIC_TALENT_TIER = 4;

/** A heroic ability's type in the hero data. */
const HEROIC = 'Heroic';

/** A talent a player picked, as the talents table shows it. */
export interface TalentCell {
  readonly name: string;
  /** The level the player had when they picked it. */
  readonly level: number;
  /** The talent's icon; null when the hero data has none. */
  readonly icon: Picture | null;
}

/** A player as the talents table names them: who, on which hero, and their silence penalties (the row head's icon). */
export interface TalentPlayer extends PlayerIdentity {
  /** The replay's id for the hero, to find the hero's talents in the data. */
  readonly heroId: string;
  readonly silenced: boolean;
  readonly voiceSilenced: boolean;
}

/** A tier of a player's row: whether it is the hero's heroic tier, and the talent picked at it, if any. */
export interface TalentTier {
  /** The hero's heroic tier (all its talents heroics: level 10 for most heroes), framed as the game frames it. */
  readonly heroic: boolean;
  /** Null for a tier not picked. */
  readonly talent: TalentCell | null;
}

/** One player's row of the talents table. */
export interface TalentRow {
  readonly key: number;
  readonly player: TalentPlayer;
  /** The hero's leaderboard portrait, the row head's. */
  readonly portrait: HeroIcon | null;
  /** The team's theme (`theme`), the user's own (`blue-self`, `red-self`) for them; none for a player without a team. */
  readonly theme: StatRowTheme | undefined;
  /** By tier, in {@link TALENT_TIERS}' order. */
  readonly tiers: readonly TalentTier[];
}

/**
 * Each player's talents by tier, grouped by team and themed in its colour from your point of
 * view (your team first, then by slot), your own rows in your side's self theme, named and
 * pictured from the hero data where it knows the talent and by the game's own id otherwise. A
 * tier is heroic where all the hero's talents at it are heroics (the hero's tiers its talents'
 * levels, in order); none before the data loads.
 */
export function talentRows(
  players: readonly TalentPlayer[],
  picks: readonly TalentPickRow[],
  portraits: Readonly<Record<number, HeroIcon | null>>,
  data: Pick<HeroDataSet, 'hero' | 'talent'> | null,
  images: Pick<HeroesImages, 'icon'>,
  yourTeam: Team | null,
  mode: TeamColorMode,
  you: ReadonlySet<number> = new Set(),
): TalentRow[] {
  const cell = (pick: TalentPickRow): TalentCell => {
    const info = data?.talent(pick.talent);
    return {
      name: info?.name ?? pick.talent,
      level: pick.level,
      icon: info ? images.icon(info) : null,
    };
  };
  /**
   * The tiers (1-based) at which all the hero's talents are heroics: level 10 for all heroes but
   * Varian (level 4) and Deathwing (none). A tier with only some (level 20's heroic upgrades) isn't.
   */
  const heroicTiers = (player: TalentPlayer): Set<number> => {
    const hero = data?.hero(player.heroId) ?? data?.hero(player.hero);
    const talents = hero?.talents ?? [];
    const levels = [...new Set(talents.map((t) => t.level))].sort((a, b) => a - b);
    return new Set(
      levels
        .map(
          (level, i) =>
            [i + 1, talents.filter((t) => t.level === level).every((t) => t.abilityType === HEROIC)] as const,
        )
        .filter(([, heroic]) => heroic)
        .map(([tier]) => tier),
    );
  };
  return playerRows(players, portraits, [], yourTeam, mode, you).map((row) => {
    const own = picks.filter((p) => p.slot === row.data.player.slot);
    const heroic = heroicTiers(row.data.player);
    return {
      key: row.data.player.slot,
      player: row.data.player,
      portrait: row.data.icon,
      theme: row.theme,
      tiers: TALENT_TIERS.map((tier): TalentTier => {
        const pick = own.find((p) => p.tier === tier);
        return { heroic: heroic.has(tier), talent: pick ? cell(pick) : null };
      }),
    };
  });
}
