import type { CampState, TownState } from '../../model';

/** Names camps by type, numbering the types with several: Siege Camp 1, Siege Camp 2, Boss Camp. */
export function campNames(camps: readonly CampState[]): string[] {
  return camps.map((c) => {
    const type = c.type ?? 'Camp';
    const same = camps.filter((o) => (o.type ?? 'Camp') === type);
    return same.length > 1 ? `${type} ${same.indexOf(c) + 1}` : type;
  });
}

/**
 * A town's name: where its lane runs, and its number from the outer town in when the lane has
 * several (Top town 1 is the fort's, Top town 2 the keep's).
 */
export function townName(town: TownState, laneTowns: readonly TownState[]): string {
  const place = town.place ? `${town.place[0]!.toUpperCase()}${town.place.slice(1)} town` : 'Town';
  return laneTowns.length > 1 ? `${place} ${laneTowns.indexOf(town) + 1}` : place;
}

/** A camp's level, as a rarity theme: siege camps rare, bruiser camps epic, boss camps legendary. */
export type CampRarity = 'rare' | 'epic' | 'legendary';

const RARITIES: readonly CampRarity[] = ['rare', 'epic', 'legendary'];

/**
 * A camp's rarity theme by the game's name for its type (`Siege Camp`), an elite camp's (the game's
 * `lv_campIsElite`: Hanamura's Sentinel) one higher, legendary at most; null for the others.
 */
export function campRarity(type: string | null, elite = false): CampRarity | null {
  if (!type) return null;
  const level = /siege/i.test(type) ? 0 : /bruiser/i.test(type) ? 1 : /boss/i.test(type) ? 2 : -1;
  if (level < 0) return null;
  return RARITIES[Math.min(level + (elite ? 1 : 0), RARITIES.length - 1)]!;
}
