import { type PartSettingsMap, withPart } from '../formats/part-shapes';
import { ownPartKey, overlayPartKey } from '../formats/part-keys';
import type { PlanetFile } from '../formats/planet-files';
import { wornParts } from '../formats/wear';
import { reach } from '../space/space';

/**
 * How much of the view a body takes, in its radii: its parts as set (`set`); its spheres (its
 * own, its atmosphere's shells, its overlays' as it wears them) and past them the bloom their glow spreads into; and its rings
 * (its overlays', its own for them where it has any), sized as seen from afar (their biggest), a
 * glow at the limb of their own (the bloom isn't added past them again).
 */
export const HALO_MARGIN = 1.12;

export function visualExtent(
  file?: PlanetFile,
  overlays: readonly { readonly id: string; readonly file?: PlanetFile }[] = [],
  set?: PartSettingsMap,
  /** The room its glow is given past its spheres (times their reach). */
  margin = HALO_MARGIN,
): number {
  const parts = [
    ...(file?.parts ?? []).map((p) => withPart(p, set?.[ownPartKey(p)])),
    ...overlays.flatMap((o) =>
      (o.file ? wornParts(file, o.id, o.file.parts) : []).map((p) =>
        withPart(p, set?.[overlayPartKey(o.id, p)]),
      ),
    ),
  ];
  // Its spheres, tubes, cones and discs with room for their glow; its rings as they lie.
  const solids = parts.filter((p) => p.shape.kind !== 'ring');
  const rings = parts.filter((p) => p.shape.kind === 'ring');
  return Math.max(margin * reach(solids), reach(rings, Infinity));
}
