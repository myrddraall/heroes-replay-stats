import type { VariantRow } from '../variants/variant-list';
import type { Signal } from '@angular/core';
import {
  BodySettings,
  CreatedShape,
  Orbit,
  Vec3,
} from '@myrddraall/heroes-replay-stats-aether/design';
import {
  MaterialSettings,
  MaterialTint,
  PartSettings,
  SceneCamera,
  SceneCameraSet,
  SkyAnchor,
} from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  LightId,
  LightSettings,
  NewLightKind,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import type { PickChoice } from '../controls/pick-list';
import type { BodyView, TargetKind } from './model/body';
import type { LightEntry, LitByEntry } from './model/lights';
import type { MaterialEntry } from './model/materials';
import type { MaterialView } from './model/views';
import type { PartEntry } from './model/parts';
import type { SkyAnchorView } from './model/sky';
import type { AssetTarget, OpenTarget } from '../layout/open-target';
import type { TreeMove, TreeRow } from '../tree/scene-tree';
import type { PoleDrag, SceneMarker } from '../viewport/scene-markers';
import type { AddedLists } from '../controls/added-list';

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
  /** An overlay the selected body wears shown in the tree, its rows unfolded. */
  abstract showOverlay(id: string): void;
  abstract removeOverlay(id: string): void;
  abstract resetOverlays(): void;

  // Variants (see `variants.ts`): the selected body's own, switched on or off where it is.
  /** The selected body's variants, each switched on or off where it is (none: no list). */
  abstract readonly variantRows: Signal<readonly VariantRow[]>;
  /** Whether variants can be made, edited and deleted here (a planet's, in the library), else only switched. */
  abstract readonly variantsEditable: Signal<boolean>;
  /** The variant open to be edited, if one is. */
  abstract readonly variantEdited: Signal<string | null>;
  /** Whether which variants are on is set at the level edited. */
  abstract readonly variantsOnSet: Signal<boolean>;
  /** Whether a variant can be made of what is set on the selected body (see `variantSettingsOf`). */
  abstract readonly variantFromChangesOffered: Signal<boolean>;
  abstract setVariantOn(id: string, on: boolean): void;
  abstract resetVariantsOn(): void;
  abstract editVariant(id: string | null): void;
  abstract newVariant(): void;
  abstract variantFromChanges(): void;
  abstract deleteVariant(id: string): void;
  abstract renameVariant(id: string, name: string): void;
  /**
   * The levels what is set can go into (a planet's own settings and its variants; a scene and its
   * variants), by value ('': the owner's own); none offered: one only.
   */
  abstract readonly layerOptions: Signal<readonly PickChoice[]>;
  /** The level what is set goes into ('': the owner's own). */
  abstract readonly layer: Signal<string>;
  abstract setLayer(value: string): void;
  /** The level named so (as an override names it) made the one edited, where it is one here. */
  abstract showLayer(name: string): void;

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
  abstract addLight(kind: NewLightKind): void;
  /** A light taken out, where it was added at the level edited: one of the selected body's (by id), else the one selected. */
  abstract removeLight(id?: LightId): void;
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
  /** An overlay the sky selected wears shown in the tree, its rows unfolded. */
  abstract showSkyOverlay(id: string): void;
  abstract removeSkyOverlay(id: string): void;
  abstract resetSkyOverlays(): void;
  abstract setSkyTint(tint: MaterialTint): void;
  abstract clearSkyTint(): void;
  /** How the sky selected is anchored against the camera, as shown, as set in the layer edited, and where else it is set. */
  abstract readonly skyAnchor: Signal<SkyAnchorView>;
  abstract setSkyAnchor(anchor: SkyAnchor): void;
  abstract clearSkyAnchor(): void;
  abstract resetSky(): void;

  /** Everything in the layer edited back as what is under it (a scene; the whole library). */
  /**
   * The shapes of part that may be added to what is selected (a body, a sky, an overlay made in the
   * editor, at the level edited); none: nothing may be.
   */
  abstract readonly partShapes: Signal<readonly CreatedShape[]>;
  /** The game data's parts that may be reused there, by name. */
  abstract readonly reusableParts: Signal<readonly PickChoice[]>;
  /** A new part of a shape added there (selected), one of the game data's reused, or the selected one taken out. */
  abstract addPart(shape: CreatedShape): void;
  abstract reusePart(value: string): void;
  abstract removePart(): void;
  /** Whether the parts added onto what is selected at the level edited may be saved as an overlay. */
  abstract readonly canSaveAsOverlay: Signal<boolean>;
  /** Those parts saved as a new overlay (what is selected wearing it in their place, where it can). */
  abstract saveAsOverlay(): void;
  /**
   * The materials the selected part draws (one made in the editor at the level edited: an
   * overlay's, or added onto a body or sky), in order, and those it may draw; null where its
   * materials are its data's.
   */
  abstract readonly partMaterials: Signal<{
    readonly picked: readonly string[];
    readonly choices: readonly PickChoice[];
  } | null>;
  abstract addPartMaterial(name: string): void;
  abstract removePartMaterial(name: string): void;
  /** The camera the view shows the scene through, where it can be moved (a scene's; none: none). */
  abstract readonly camera: Signal<SceneCamera | null>;
  /** The camera the view looks through moved (dragged in the view). */
  abstract moveCamera(set: SceneCameraSet): void;
  /** A planet's pole dragged in the view (the selected body's): its Axis moved, the planet kept as it is. */
  abstract dragPole(drag: PoleDrag): void;
  /** What a drag in the view orbits round, kept where it is in the view (a planet open); none: what the view looks at. */
  abstract readonly orbitAbout: Signal<Vec3 | null>;
  /** What the view may look through (the editor's camera, a scene's cameras), by id; none: no choice. */
  abstract readonly lookOptions: Signal<readonly { readonly id: string; readonly label: string }[]>;
  abstract readonly look: Signal<string>;
  /** What it looks through now (the library's preview: a scene's camera, never the editor's). */
  abstract readonly lookShown: Signal<string>;
  abstract lookThrough(id: string): void;
  /** Whether the editor's camera is moved from the scene's primary, and putting it back. */
  abstract readonly editorCameraMoved: Signal<boolean>;
  abstract resetEditorCamera(): void;
  /**
   * What has been added to what is selected, listed under where it is added (a scene's planets
   * and groups, cameras and lights; a body's moons and parts; a sky's parts), each by its row.
   */
  abstract readonly added: Signal<AddedLists>;
  /** One of them selected in the tree, its rows unfolded to it; or taken out. */
  abstract showAdded(key: string): void;
  abstract removeAdded(key: string): void;
  /** What the view marks where it is (cameras, groups put in it, the selected's lights). */
  abstract readonly markers: Signal<readonly SceneMarker[]>;
  /** What a marker stands for selected, its rows unfolded to it. */
  abstract showMarker(key: string): void;
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
  /** The selected planet moved or sized (a scene's planet: an asset has no place). */
  abstract setPlace(change: { readonly position?: Vec3; readonly radius?: number }): void;
  abstract addMoon(moon: string): void;
  abstract removeMoon(): void;
  abstract toggleFocus(): void;
}
