import {
  type CampTypeInfo,
  type MapUnitsInfo,
  scalingRank,
  scalingTotals,
} from '@myrddraall/hero-data';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { CampState, TeamColor } from '../../model';
import { type CampRarity, campNames, campRarity } from './map-names';

/**
 * A replay camp's camp type (heroes-assets): the one whose defenders are the camp's, or failing
 * that the one sharing most of them; null when none shares any (or there are no camp types).
 */
export function campTypeOf(camp: CampState, units: MapUnitsInfo | null): CampTypeInfo | null {
  if (!units || !camp.defenders.length) return null;
  const own = new Set(camp.defenders);
  let best: CampTypeInfo | null = null;
  let bestShared = 0;
  for (const type of units.camps) {
    const theirs = type.defenders.map((d) => d.unit);
    const shared = theirs.filter((u) => own.has(u)).length;
    if (shared === theirs.length && shared === own.size) return type;
    if (shared > bestShared) [best, bestShared] = [type, shared];
  }
  return best;
}

/** A camp's rarity theme: its type's, one higher where its camp type is elite (`campRarity`). */
export function campRarityOf(camp: CampState, units: MapUnitsInfo | null): CampRarity | null {
  return campRarity(camp.type, campTypeOf(camp, units)?.elite ?? false);
}

/**
 * Each camp's name: its camp type's label as the game shows it (`Knights`, `Impaler`), numbered
 * where two camps share one; the game's name for its type (`Siege Camp 1`) without a label.
 */
export function campLabels(camps: readonly CampState[], units: MapUnitsInfo | null): string[] {
  const fallback = campNames(camps);
  const labels = camps.map((c, i) => campTypeOf(c, units)?.label ?? fallback[i]!);
  return labels.map((label, i) => {
    const same = labels.filter((l) => l === label).length;
    return same > 1 && label !== fallback[i]
      ? `${label} ${labels.slice(0, i + 1).filter((l) => l === label).length}`
      : label;
  });
}

/** Where a camp is: its third of the map, and whose side (`Top, Blue team's side`, `Bottom, centre`). */
export function campPlace(
  camp: CampState,
  colorOf: (team: Team | null) => TeamColor | null,
  teamName: (color: TeamColor) => string,
): string {
  const third = `${camp.place[0]!.toUpperCase()}${camp.place.slice(1)}`;
  const color = colorOf(camp.side);
  return color ? `${third}, ${teamName(color)}'s side` : `${third}, centre`;
}

/** A unit's portrait for a team (Order's first where the map has two), named for the unit; null without one. */
export function unitIcon(
  units: MapUnitsInfo | null,
  unit: string,
  team: Team | null = 0,
): HeroIcon | null {
  const info = units?.units[unit];
  const picture = info?.portraits[team ?? 0] ?? info?.portraits[0];
  return info && picture ? { picture, name: info.name ?? unit } : null;
}

/**
 * A camp's row head: its units' portraits, each picture once (Hanamura's three Henchmen share one),
 * in the camp type's order.
 */
export function campHeadIcons(camp: CampState, units: MapUnitsInfo | null): HeroIcon[] {
  const type = campTypeOf(camp, units);
  const kinds = type ? type.defenders.map((d) => d.unit) : camp.defenders;
  const seen = new Set<string>();
  return kinds.flatMap((unit) => {
    const icon = unitIcon(units, unit, null);
    const key = icon && `${icon.picture.src} ${icon.picture.rect?.join() ?? ''}`;
    if (!icon || !key || seen.has(key)) return [];
    seen.add(key);
    return [icon];
  });
}

/** One kind of mercenary a capture sent, at its rank then. */
export interface MercAtRank {
  readonly name: string;
  readonly count: number;
  readonly life: number | null;
  readonly damage: number | null;
}

/**
 * The mercenaries a camp's capture `seconds` after the gates opened sends into lane, at their
 * rank then (the game's scaling: a tick a minute, each level's additions summed up to it).
 */
export function mercsAtRank(
  camp: CampState,
  units: MapUnitsInfo | null,
  seconds: number,
): { rank: number; mercs: MercAtRank[] } | null {
  const type = campTypeOf(camp, units);
  if (!units || !type?.mercs.length) return null;
  const levels = (type.mercScaling && units.scaling[type.mercScaling]) || [];
  const rank = scalingRank(seconds, units.scalingTicks, levels.length);
  const totals = scalingTotals(levels, rank);
  return {
    rank,
    mercs: type.mercs.map(({ unit, count }) => {
      const info = units.units[unit];
      const life = info?.life ? info.life.amount + (totals['VitalMaxArray.Life'] ?? 0) : null;
      const weapon = info?.weapons[0];
      const damage = weapon ? weapon.damage + (totals['DamageDealtScaled.Basic'] ?? 0) : null;
      return { name: info?.name ?? unit, count, life, damage };
    }),
  };
}
