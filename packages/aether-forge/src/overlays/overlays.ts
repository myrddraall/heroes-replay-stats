import type { LibraryState } from '@myrddraall/heroes-replay-stats-aether/library';
import { overlayName } from '@myrddraall/heroes-replay-stats-aether/overlays';
import type { PlanetIndex } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { PickChoice } from '../controls/pick-list';
import type { MaterialEntry } from '../materials/materials';
import { type BodyInfo, bodyLabel, overlayLabel } from '../bodies/body';

/** The overlays a body may wear, as an editor offers them. */

/**
 * The overlays a body may wear, by name: the game data's (the index's styles), and those made in
 * the editor (the library's), each as renamed in the library.
 */
export function overlayChoices(index: PlanetIndex | null, library: LibraryState): PickChoice[] {
  const ids = [
    ...(index?.styles.map((s) => s.id) ?? []),
    ...Object.entries(library.created ?? {})
      .filter(([, o]) => o.kind === 'planet')
      .map(([id]) => id),
  ];
  return ids.map((id) => ({ value: id, label: overlayName(library, id) }));
}

/**
 * A body's materials' draw order with its overlays' in the order it wears them (`worn`): its own
 * first, then each overlay's, each keeping the order they are drawn in now.
 */
export function overlayOrder(
  materials: readonly MaterialEntry[],
  worn: readonly string[],
): string[] {
  return [
    ...materials.filter((m) => !m.overlay).map((m) => m.key),
    ...worn.flatMap((id) => materials.filter((m) => m.overlay === id).map((m) => m.key)),
  ];
}

/** A body's name with the overlays it wears. */
export const wornLabel = (b: BodyInfo) =>
  b.overlays.length
    ? `${bodyLabel(b)} · ${b.overlays.map(overlayLabel).join(' + ')}`
    : bodyLabel(b);
