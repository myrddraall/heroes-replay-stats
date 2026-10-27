import type { LibraryState } from '@myrddraall/heroes-replay-stats-aether/library';
import { overlayName } from '@myrddraall/heroes-replay-stats-aether/overlays';
import type { PlanetIndex } from '@myrddraall/heroes-replay-stats-aether/formats';
import type { PickChoice } from '../controls/pick-list';
import { type BodyInfo, bodyLabel, overlayEnabled, overlayLabel } from '../bodies/body';

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

/** A body's name with the overlays it wears. */
export const wornLabel = (b: BodyInfo) =>
  b.overlays.length
    ? `${bodyLabel(b)} · ${b.overlays.map(overlayLabel).join(' + ')}`
    : bodyLabel(b);

/** An overlay a body wears, as its panel shows it: which, its name, whether it is drawn. */
export interface OverlayView {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
}

/** One of the overlays a body wears as its panel shows it (none: it doesn't wear it). */
export function overlayViewOf(b: BodyInfo | null | undefined, id: string): OverlayView | null {
  const o = b?.overlays.find((x) => x.id === id);
  return b && o ? { id, name: overlayLabel(o), enabled: overlayEnabled(b, id) } : null;
}
