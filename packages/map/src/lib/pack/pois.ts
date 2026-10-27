import type { ElementKind } from '../layers/elements/element-pieces';
import type { Cell, MapPack, PackCamp, PackStructure } from './map-pack';

export type PoiOwner = 'order' | 'chaos' | null;

/** A point of interest: a structure or a camp of the pack, as a list shows it. */
export interface Poi {
  /** The element's key (`structure-<id>`, `camp-<camp>`), as the viewer reports and takes it. */
  readonly key: string;
  readonly kind: ElementKind;
  /** What it is, in words ("Fort", "Tower", "Siege camp"). */
  readonly label: string;
  /** The game's type name, as the pack has it. */
  readonly type: string;
  readonly cell: Cell;
  /** The map layer it is on: its arena's, on a map of several. */
  readonly layer: string;
  readonly owner: PoiOwner;
  readonly town: number | null;
  readonly outpost: number | null;
  readonly core: boolean;
}

/** The points of interest that belong together: a core, a town, an outpost, the loose ones, the camps. */
export interface PoiGroup {
  readonly id: string;
  readonly label: string;
  readonly owner: PoiOwner;
  readonly pois: readonly Poi[];
}

/** One side's points of interest, in groups: Order, Chaos, or neither (the camps). */
export interface PoiTeam {
  readonly id: 'order' | 'chaos' | 'neutral';
  readonly label: string;
  readonly owner: PoiOwner;
  readonly groups: readonly PoiGroup[];
}

const TEAM_LABEL: Record<PoiTeam['id'], string> = {
  order: 'Order',
  chaos: 'Chaos',
  neutral: 'Neutral',
};

/** A structure's type name in words; a type not known is given as it is. */
export function structureLabel(type: string): string {
  if (type === 'KingsCore') return 'Core';
  if (type.startsWith('TownTownHallL2')) return 'Fort';
  if (type.startsWith('TownTownHallL3')) return 'Keep';
  if (type.startsWith('TownTownHall')) return 'Hall';
  if (type.startsWith('TownCannonTower')) return 'Tower';
  if (type.startsWith('TownGate')) return 'Gate';
  if (type.startsWith('TownWall')) return 'Wall';
  if (type.startsWith('TownMoonwell')) return 'Healing fountain';
  return type;
}

/** A camp's type name in words. */
export function campLabel(type: string): string {
  if (type.includes('Siege')) return 'Siege camp';
  if (type.includes('Bruiser')) return 'Bruiser camp';
  if (type.includes('Boss')) return 'Boss camp';
  return type;
}

/** Where a structure comes in its group's list: the hall first, then towers, gate, fountain, walls. */
const RANK: Record<string, number> = {
  Core: 0,
  Fort: 0,
  Keep: 0,
  Hall: 0,
  Tower: 1,
  Gate: 2,
  'Healing fountain': 3,
  Wall: 4,
};

function structurePoi(s: PackStructure, layer: string): Poi {
  return {
    key: `structure-${s.id}`,
    kind: 'structure',
    label: structureLabel(s.type),
    type: s.type,
    cell: s.cell,
    layer: s.layer ?? layer,
    owner: s.owner,
    town: s.town,
    outpost: s.outpost,
    core: s.core,
  };
}

function campPoi(c: PackCamp, layer: string): Poi {
  return {
    key: `camp-${c.camp}`,
    kind: 'camp',
    label: campLabel(c.type),
    type: c.type,
    cell: c.cell,
    layer: c.layer ?? layer,
    owner: null,
    town: null,
    outpost: null,
    core: false,
  };
}

function byRank(a: Poi, b: Poi): number {
  return (RANK[a.label] ?? 5) - (RANK[b.label] ?? 5) || a.key.localeCompare(b.key);
}

function numbers(pois: readonly Poi[], of: (p: Poi) => number | null): number[] {
  return [...new Set(pois.map(of))].filter((n): n is number => n !== null).sort((a, b) => a - b);
}

/**
 * One side's groups: its core; its towns by number, each (the hall's ring: hall first, then
 * towers, gate, fountain, walls) followed by the town's outposts; its structures of no town
 * ("Other"); and, for neither side, the mercenary camps.
 */
function groupsOf(owner: PoiOwner, structures: readonly Poi[], camps: readonly Poi[]): PoiGroup[] {
  const own = structures.filter((p) => p.owner === owner);
  const groups: PoiGroup[] = [];
  const cores = own.filter((p) => p.core);
  if (cores.length)
    groups.push({ id: `core-${owner ?? 'none'}`, label: 'Core', owner, pois: cores });
  for (const town of numbers(own, (p) => p.town)) {
    const inTown = own.filter((p) => p.town === town && !p.core);
    const ring = inTown.filter((p) => p.outpost === null).sort(byRank);
    if (ring.length) groups.push({ id: `town-${town}`, label: `Town ${town}`, owner, pois: ring });
    for (const outpost of numbers(inTown, (p) => p.outpost)) {
      const pois = inTown.filter((p) => p.outpost === outpost).sort(byRank);
      groups.push({ id: `outpost-${outpost}`, label: `Outpost ${outpost}`, owner, pois });
    }
  }
  const loose = own.filter((p) => !p.core && p.town === null).sort(byRank);
  if (loose.length)
    groups.push({ id: `other-${owner ?? 'none'}`, label: 'Other', owner, pois: loose });
  if (owner === null && camps.length) {
    groups.push({ id: 'camps', label: 'Mercenary camps', owner, pois: camps });
  }
  return groups;
}

/**
 * The pack's points of interest by team, in the order a list shows them: Order, then Chaos (each
 * its core, its towns and their outposts, its loose structures), then neither side (the
 * mercenary camps). A team with nothing is left out. Nothing for a pack without an elements
 * render.
 */
export function poisOf(pack: MapPack): readonly PoiTeam[] {
  const elements = pack.data.elements;
  if (!elements) return [];
  const structures = elements.structures.map((s) => structurePoi(s, elements.layer));
  const camps = elements.camps
    .map((c) => campPoi(c, elements.layer))
    .sort((a, b) => a.key.localeCompare(b.key));
  const teams: PoiTeam[] = [];
  for (const id of ['order', 'chaos', 'neutral'] as const) {
    const owner = id === 'neutral' ? null : id;
    const groups = groupsOf(owner, structures, camps);
    if (groups.length) teams.push({ id, label: TEAM_LABEL[id], owner, groups });
  }
  return teams;
}

/** Every point of interest of the teams, flat, in list order. */
export function allPois(teams: readonly PoiTeam[]): readonly Poi[] {
  return teams.flatMap((t) => t.groups.flatMap((g) => g.pois));
}
