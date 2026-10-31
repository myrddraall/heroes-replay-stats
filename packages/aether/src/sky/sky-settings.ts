import type { SkyOverlayFile } from '../formats/play-scene';
import type { MaterialSettingsMap } from '../materials/material-settings';
import type { TintLayer, TintSwitches } from '../tints/tint-layers';
import type { SkyAnchor } from './sky-anchors';
import type { AddedPart, PartSettingsMap } from '../formats/part-shapes';

/**
 * How the sky shows: its materials' settings by key (`materialKey`), a tint over all of it
 * (its stars too), and the overlays it wears.
 */
export interface SkySettings {
  /** Its materials' settings: its own by name (over their base settings), its overlays' by `materialKey`. */
  readonly materials?: MaterialSettingsMap;
  /** The materials' base settings, by name (under its overlays' materials' own). */
  readonly base?: MaterialSettingsMap;
  readonly tints?: readonly TintLayer[];
  /** Which of its tints are drawn, by id (see `TintsSet`). */
  readonly tintsEnabled?: TintSwitches;
  /** How it is anchored against the camera, where its materials don't say otherwise (unset: `world`). */
  readonly anchor?: SkyAnchor;
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /** The overlays it wears and draws, in order, by id (none given: its data's). */
  readonly overlays?: readonly string[];
  /** Its overlays' parts' settings, by part (`style:<overlay>:<part>`). */
  readonly parts?: PartSettingsMap;
  /** Its own parts (added onto it): their file, and the images their textures are. */
  readonly own?: {
    readonly file: SkyOverlayFile;
    readonly images: Readonly<Record<string, ImageBitmap>>;
  };
  /** The parts added onto it, under those built (`own`): as the design has them. */
  readonly addedParts?: readonly AddedPart[];
  /** Overlays made in the editor it wears, by id: their files, and the images their textures are. */
  readonly made?: Readonly<
    Record<
      string,
      { readonly file: SkyOverlayFile; readonly images: Readonly<Record<string, ImageBitmap>> }
    >
  >;
}
