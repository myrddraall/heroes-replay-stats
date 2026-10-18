import type { Signal } from '@angular/core';
import type { BodySettings, Orbit } from '../../../scenes/play-background/background-scene';
import type { MaterialSettings, MaterialTint } from '../../../scenes/play-background/scene-planets';
import type { PropertyOption } from '../properties/property-select';
import type { BodyView, MaterialEntry, TargetKind } from './editor-model';
import type { OpenTarget } from './open-target';
import type { TreeRow } from './scene-tree';

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

  /** The selected body, as its properties show it. */
  abstract readonly bodyView: Signal<BodyView | null>;
  abstract readonly styleOptions: Signal<PropertyOption[]>;
  abstract setBody(change: Partial<BodySettings>): void;
  abstract clearBody(keys: readonly (keyof BodySettings)[]): void;
  abstract resetBody(): void;
  abstract setStyle(style: string): void;
  abstract resetStyle(): void;

  /** The selected material, as its properties show it. */
  abstract readonly material: Signal<MaterialEntry | undefined>;
  abstract setMaterial(change: Partial<MaterialSettings>): void;
  abstract clearMaterial(keys?: readonly (keyof MaterialSettings)[]): void;

  /** The sky's tint, as shown and as set in the layer edited; whether anything of the sky is set. */
  abstract readonly skyTint: Signal<MaterialTint>;
  abstract readonly skyTintSet: Signal<MaterialTint | undefined>;
  abstract readonly skyChanged: Signal<boolean>;
  abstract setSkyTint(tint: MaterialTint): void;
  abstract clearSkyTint(): void;
  abstract resetSky(): void;

  /** Everything in the layer edited back as what is under it (a scene; the whole library). */
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
