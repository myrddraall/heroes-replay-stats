/** What a structure was: the town's buildings and the core (Alterac Pass's generals). */
export type StructureKind = 'fort' | 'keep' | 'tower' | 'gate' | 'wall' | 'well' | 'core';

/** A structure's kind from its unit type; null for any other unit. */
export function structureKind(type: string): StructureKind | null {
  if (type.startsWith('TownTownHallL2')) return 'fort';
  if (type.startsWith('TownTownHallL3')) return 'keep';
  if (type.startsWith('TownCannonTower')) return 'tower';
  if (type.startsWith('TownGate')) return 'gate';
  if (type.startsWith('TownWallRadial')) return 'wall';
  if (type.startsWith('TownMoonwell')) return 'well';
  if (type.startsWith('KingsCore') || type === 'VanndarStormpike' || type === 'DrekThar')
    return 'core';
  return null;
}
