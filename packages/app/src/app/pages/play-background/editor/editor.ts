import type { Signal } from '@angular/core';
import type { BodySettings, Orbit } from '../../../scenes/play-background/background-scene';
import type {
  MaterialSettings,
  MaterialTint,
  PartSettings,
} from '../../../scenes/play-background/scene-planets';
import type { CreatedShape } from '../../../scenes/play-background/created-overlays';
import type { PickChoice } from './pick-list';
import type {
  BodyView,
  LightEntry,
  LitByEntry,
  MaterialEntry,
  MaterialView,
  PartEntry,
  TargetKind,
} from './editor-model';
import type {
  LightId,
  LightKind,
  LightSettings,
} from '../../../scenes/play-background/scene-lights';
import type { AssetTarget, OpenTarget } from './open-target';
import type { TreeMove, TreeRow } from './scene-tree';

/**
 * An editor of the background's design, as the panels under it use one: provided by the scene
 * editor (a scene's overrides, over the library) or the asset editor (one of the library's
 * assets: its defaults, over the game data) for everything in its subtree, so the same tree and
 * properties edit either. What it changes is what is selected in its tree. Things only a scene
 * has (moons, the random sets) do nothing for an asset.
 */
export abstract class Editor {
  /** What it has open; what the left panel calls it. */
  abstract readonly opened: Signal<OpenTarget>;
  abstract readonly heading: Signal<string>;
  /** What is open was opened from (a material's planet or overlay), to go back to; none: the library. */
  abstract readonly parent: Signal<{ readonly target: OpenTarget; readonly label: string } | null>;
  /**
   * The selected material of a planet or overlay as the library has it (one material, shared by
   * all that use it), to open from there; none where a material of one isn't selected.
   */
  abstract readonly sharedMaterial: Signal<AssetTarget | null>;
  /** What the tree shows: as many rows as are unfolded. */
  abstract readonly rows: Signal<TreeRow[]>;
  abstract readonly selected: Signal<string>;
  /** What the selected row is; its properties' panel's title. */
  abstract readonly kind: Signal<TargetKind>;
  abstract readonly title: Signal<string>;
  abstract select(key: string): void;
  /** The body shown at an index of the scene's planets (as put up) selected; whether there was one. */
  abstract selectPlaced(index: number): boolean;
  abstract toggleExpanded(key: string): void;
  /** A material switched on or off from the tree, by its row's key. */
  abstract setEnabled(change: { key: string; enabled: boolean }): void;
  /**
   * A material moved in the tree to just before or after another (rows' keys): the order they are
   * drawn in changed. A body's stays on its part; a sky's moved into another depth's group takes
   * that depth too.
   */
  abstract moveMaterial(move: TreeMove): void;

  /** The selected body, as its properties show it. */
  abstract readonly bodyView: Signal<BodyView | null>;
  /** The overlays a body may wear, by id and name. */
  abstract readonly overlayOptions: Signal<readonly PickChoice[]>;
  abstract setBody(change: Partial<BodySettings>): void;
  abstract clearBody(keys: readonly (keyof BodySettings)[]): void;
  abstract resetBody(): void;
  /** An overlay put on the selected body (over what it wears), or taken off; what it wears back as its own. */
  abstract addOverlay(id: string): void;
  abstract removeOverlay(id: string): void;
  abstract resetOverlays(): void;

  /** What of the selected material its row shows (a layer, its shield shader, an effect); none: the material itself. */
  abstract readonly materialView: Signal<MaterialView | null>;
  /** The selected material, as its properties show it. */
  abstract readonly material: Signal<MaterialEntry | undefined>;
  abstract setMaterial(change: Partial<MaterialSettings>): void;
  abstract clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void;

  /** The selected part of a body, as its properties show it. */
  abstract readonly part: Signal<PartEntry | undefined>;
  abstract setPart(change: Partial<PartSettings>): void;
  abstract clearPart(keys?: readonly (keyof PartSettings)[]): void;

  /** The selected light of a body, as its properties show it. */
  abstract readonly light: Signal<LightEntry | undefined>;
  abstract setLight(change: Partial<LightSettings>): void;
  abstract clearLight(keys?: readonly (keyof LightSettings)[]): void;
  /** A light added: to the scene where it is selected, else to the body selected; selected. */
  abstract addLight(kind: LightKind): void;
  /** The selected light taken out, where it was added at the level edited. */
  abstract removeLight(): void;
  /** What lights the selected body, part or material (none: something else is selected). */
  abstract readonly litBy: Signal<readonly LitByEntry[] | null>;
  /** One of the lights in the selected body's Lit by selected in the tree, its rows unfolded to it. */
  abstract showLight(id: LightId): void;
  /** A light taken in or left out by the selected body, part or material. */
  abstract setLitBy(change: { readonly id: LightId; readonly on: boolean }): void;

  /** The sky's tint, as shown and as set in the layer edited; whether anything of the sky is set. */
  abstract readonly skyTint: Signal<MaterialTint>;
  abstract readonly skyTintSet: Signal<MaterialTint | undefined>;
  abstract readonly skyChanged: Signal<boolean>;
  /** The overlays the sky selected wears (by id, in order), those it may, and whether chosen here. */
  abstract readonly skyWorn: Signal<readonly string[]>;
  abstract readonly skyOverlayOptions: Signal<readonly PickChoice[]>;
  abstract readonly skyOverlaysSet: Signal<boolean>;
  /** An overlay put on the sky selected (over what it wears), or taken off; what it wears back as under it. */
  abstract addSkyOverlay(id: string): void;
  abstract removeSkyOverlay(id: string): void;
  abstract resetSkyOverlays(): void;
  abstract setSkyTint(tint: MaterialTint): void;
  abstract clearSkyTint(): void;
  abstract resetSky(): void;

  /** Everything in the layer edited back as what is under it (a scene; the whole library). */
  /** The shapes of part the overlay open may have added (one made in the editor; none: none). */
  abstract readonly partShapes: Signal<readonly CreatedShape[]>;
  /** A part of a shape added to the overlay open (selected), or the selected one taken out. */
  abstract addPart(shape: CreatedShape): void;
  abstract removePart(): void;
  /**
   * The materials the selected part draws (one of an overlay made in the editor's), in order, and
   * those it may draw; null where its materials are its data's.
   */
  abstract readonly partMaterials: Signal<{
    readonly picked: readonly string[];
    readonly choices: readonly PickChoice[];
  } | null>;
  abstract addPartMaterial(name: string): void;
  abstract removePartMaterial(name: string): void;
  /** Whether the asset open can be deleted (an overlay made in the editor), and deleting it. */
  abstract readonly deletable: Signal<boolean>;
  /** Whether the asset open is a sky's overlay (drawn as the sky is: nothing lights it). */
  abstract readonly skyOverlayOpen: Signal<boolean>;
  abstract deleteAsset(): void;

  abstract readonly resetAllLabel: Signal<string>;
  abstract resetAll(): void;

  // A scene's (nothing in the library).
  /** Whether the random sets are shown (another can be drawn). */
  abstract readonly sets: Signal<boolean>;
  abstract anotherSet(): void;
  abstract setOrbit(change: Partial<Orbit>): void;
  abstract addMoon(moon: string): void;
  abstract removeMoon(): void;
  abstract toggleFocus(): void;
}
