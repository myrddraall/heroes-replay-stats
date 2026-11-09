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
