import type { AddedPart, PartSettingsMap } from '../formats/part-shapes';
import type { AddedLight, LightSettingsMap } from '../lights/lights';
import type { MaterialSettingsMap, MaterialTint } from '../materials/material-settings';
import type { Orientation, Quat } from '../space/graph';
import type { Vec3 } from '../space/vectors';

/** A body's settings as the saved designs and the game data keep them, and its variants. */

/** A body's settings set on this page, each where set (else its own apply). */
export interface BodySettings {
  /** Its name as shown, in place of its id (a style's: the overlay's, wherever it is worn). */
  readonly label?: string;
  /** Whether it is drawn, its moons with it (a scene's). */
  readonly enabled?: boolean;
  /**
   * Whether the overlays it wears are drawn: off, it is drawn as if it wore none of them (what it
   * wears kept). Kept before bodies wore several; each one's own switch is `overlaysEnabled`.
   */
  readonly overlayEnabled?: boolean;
  /** Whether each overlay it wears is drawn, by the overlay's id (off: as if it didn't wear it, kept). */
  readonly overlaysEnabled?: Readonly<Record<string, boolean>>;
  /**
   * The overlays a planet wears wherever it is put and nothing chooses otherwise (a planet's, in
   * the library), the later over the earlier; none: its data's.
   */
  readonly overlays?: readonly string[];
  /**
   * A planet's own variants (the library's: those made in the editor, and changes to its data's,
   * by id; see `variantsOf`).
   */
  readonly variants?: readonly BodyVariant[];
  /** Which of its variants are on, by id (the library's for a planet: by default; a scene's: there). */
  readonly variantsOn?: readonly string[];
  /**
   * Its rig made stronger and turned together (`lighting`, `lightFrom`): kept from before lights
   * were objects, folded into its lights as they start (`tunedRig`), no longer set.
   */
  readonly lighting?: number;
  readonly shade?: number;
  /** A tint over all its materials. */
  readonly tint?: MaterialTint;
  /**
   * How much room its glow is given past its spheres where the view is fitted to it, times their
   * reach (`HALO_MARGIN` unless set).
   */
  readonly glowMargin?: number;
  /**
   * Which way its surfaces are turned (see `Orientation`; its parts and materials may set their
   * own); where its poles point (its frame: its placement frame for a surface fixed in the world,
   * its frame facing the eye for a billboard; none: as its data has them) and its turn about them
   * (degrees; none: 0), which side of it is seen; and its base turn, its pose before its Turn, kept
   * so its Axis can change without turning it (none: none; see `bodyTurn`).
   */
  readonly orientation?: Orientation;
  readonly axis?: Vec3;
  readonly turn?: number;
  readonly baseTurn?: Quat;
  /** (See `lighting`.) Where its shade darkens it and its rims and glows lean (its frame). */
  readonly lightFrom?: Vec3;
  readonly shadeTowards?: Vec3;
  readonly rim?: Vec3;
  /** Its materials' settings: its own by name, its overlays' by `materialKey` (the overlay's and the name). */
  readonly materials?: MaterialSettingsMap;
  /** Its parts' settings, by part (its own and its style's). */
  readonly parts?: PartSettingsMap;
  /** Its lights' settings, by light (its rig's and its shadow, and any added under it). */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (an overlay's: to the bodies wearing it). */
  readonly added?: readonly AddedLight[];
  /** Its materials' draw order, by `materialKey` (the later over the earlier; see `drawOrder`), where set. */
  readonly order?: readonly string[];
  /**
   * Parts added onto it at this level (its own, as its data's are: keyed `own:<id>`, their
   * materials by name), after those added under it.
   */
  readonly addedParts?: readonly AddedPart[];
}

/**
 * Variants: a body's own variations of itself (not shared, as overlays are), each a set of changes
 * to its settings, named, switched on or off. Those on stack in the order of its list, over its own
 * settings and under a scene's. A variant may switch an overlay the body wears on or off
 * (`overlaysEnabled`), never put one on: what a body can wear is its own list.
 *
 * A planet's variants are its data's (the export's, in the planet index) and the library's: those
 * made in the editor, and the library's changes to the data's (by id). Which are on is a setting
 * like any other (`variantsOn`): the library's for the planet, a scene's for it there; and a
 * scene's own variants switch its planets' variants (`SceneVariant`).
 */

/** A variant as kept: its id, name, and the changes it makes (a data variant's, changed: only the changes). */
export interface BodyVariant {
  readonly id: string;
  readonly name?: string;
  readonly settings?: BodySettings;
}
