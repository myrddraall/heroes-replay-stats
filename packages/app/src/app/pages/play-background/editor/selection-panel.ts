import { Component, computed, inject } from '@angular/core';
import type { LayerSettings, LayerSlot } from '../../../scenes/play-background/scene-planets';
import { DraftDesignStore } from '../draft-design.store';
import type { PropertyOption } from '../properties/property-select';
import { AddPlanet } from './add-planet';
import { AssetCatalogStore } from './asset-catalog.store';
import { BodyProperties } from './body-properties';
import {
  EditingAidProperties,
  type EditingAidChanged,
  type EditingAidValues,
} from './editing-aid-properties';
import {
  type BackdropFill,
  EDITING_AIDS_DEFAULTS,
  type EditingAidsState,
  EditingAidsStore,
  type GridSize,
  type StandInFill,
} from './editing-aids.store';
import { Editor } from './editor';
import { EditorUiStore } from './editor-ui.store';
import { EffectProperties } from './effect-properties';
import type { LayerEntry, MaterialEntry } from './editor-model';
import { LayerProperties } from './layer-properties';
import { MaterialProperties } from './material-properties';
import { PatternProperties } from './pattern-properties';
import { PartProperties } from './part-properties';
import { LightProperties } from './light-properties';
import { AddLight } from './add-light';
import { LitBy } from './lit-by';
import { ReferenceProperties, type ReferenceValues } from './reference-properties';
import { SceneEditorStore } from './scene-editor.store';
import { SceneProperties } from './scene-properties';
import { TintSection } from './tint-section';

/**
 * The properties of what is selected in the tree (container, on the `Editor` in effect: the scene
 * editor's or the asset editor's): the scene's own (the scene editor's only), a sky's (a tint
 * over all of it), a body's or a material's, each as its presentational properties show them,
 * what they change going back to the editor, which writes it to the layer it edits; and the
 * editing aids' (the page's aids store: never the design), the reference image's among them.
 */
@Component({
  selector: 'hrs-selection-panel',
  imports: [
    TintSection,
    SceneProperties,
    BodyProperties,
    MaterialProperties,
    PatternProperties,
    EffectProperties,
    LayerProperties,
    PartProperties,
    LightProperties,
    AddLight,
    LitBy,
    EditingAidProperties,
    ReferenceProperties,
    AddPlanet,
  ],
  templateUrl: './selection-panel.html',
  styleUrl: './selection-panel.scss',
})
export class SelectionPanel {
  protected readonly editor = inject(Editor);
  /** The scene editor, where the scene's own properties come from (none in the library). */
  protected readonly scene = inject(SceneEditorStore, { optional: true });
  protected readonly draft = inject(DraftDesignStore);
  protected readonly aids = inject(EditingAidsStore);
  private readonly ui = inject(EditorUiStore);
  private readonly catalog = inject(AssetCatalogStore);

  /** The skies there are, for the backdrop. */
  protected readonly skies = computed((): PropertyOption[] =>
    this.catalog.skies().map((s) => ({ value: s.id, label: s.label })),
  );
  protected readonly backdropFills: readonly PropertyOption[] = [
    { value: 'sky', label: 'Sky' },
    { value: 'colour', label: 'Colour' },
    { value: 'grid', label: 'Grid' },
  ];
  protected readonly standInFills: readonly PropertyOption[] = [
    { value: 'colour', label: 'Colour' },
    { value: 'grid', label: 'Grid' },
  ];

  /** The aids' properties, each aid's under the same names. */
  private readonly keys = {
    backdrop: {
      fill: 'backdrop',
      sky: 'backdropSky',
      colour: 'backdropColour',
      gridSize: 'gridSize',
    },
    standIn: {
      fill: 'standIn',
      colour: 'standInColour',
      gridSize: 'gridSize',
    },
  } as const satisfies Record<
    string,
    Partial<Record<keyof EditingAidValues, keyof EditingAidsState>>
  >;

  protected readonly backdrop = computed((): EditingAidValues => ({
    fill: this.aids.backdrop(),
    sky: this.aids.backdropSky(),
    colour: this.aids.backdropColour(),
    gridSize: this.aids.gridSize(),
  }));
  protected readonly standIn = computed((): EditingAidValues => ({
    fill: this.aids.standIn(),
    colour: this.aids.standInColour(),
    gridSize: this.aids.gridSize(),
  }));
  /** The reference image's settings, each by the aids store's name for it. */
  private readonly referenceKeys = {
    shown: 'referenceShown',
    mode: 'referenceMode',
    amount: 'referenceAmount',
    scale: 'referenceScale',
    across: 'referenceAcross',
    up: 'referenceUp',
  } as const satisfies Record<keyof ReferenceValues, keyof EditingAidsState>;
  protected readonly reference = computed((): ReferenceValues => ({
    shown: this.aids.referenceShown(),
    mode: this.aids.referenceMode(),
    amount: this.aids.referenceAmount(),
    scale: this.aids.referenceScale(),
    across: this.aids.referenceAcross(),
    up: this.aids.referenceUp(),
  }));
  protected readonly referenceChanged = computed(() => {
    const values = this.reference();
    const changed = {} as Record<keyof ReferenceValues, boolean>;
    for (const [k, key] of Object.entries(this.referenceKeys) as [
      keyof ReferenceValues,
      keyof EditingAidsState,
    ][])
      changed[k] = values[k] !== EDITING_AIDS_DEFAULTS[key];
    return changed;
  });
  protected readonly backdropChanged = computed(() => this.changedOf('backdrop'));
  protected readonly standInChanged = computed(() => this.changedOf('standIn'));

  private changedOf(aid: 'backdrop' | 'standIn'): EditingAidChanged {
    const keys: Partial<Record<keyof EditingAidValues, keyof EditingAidsState>> = this.keys[aid];
    const differs = (k: keyof EditingAidValues) => {
      const key = keys[k];
      // (By value: a direction kept in this browser comes back a new array.)
      return (
        !!key && JSON.stringify(this.aids[key]()) !== JSON.stringify(EDITING_AIDS_DEFAULTS[key])
      );
    };
    return {
      fill: differs('fill'),
      sky: differs('sky'),
      colour: differs('colour'),
      gridSize: differs('gridSize'),
    };
  }

  protected setAid(aid: 'backdrop' | 'standIn', change: Partial<EditingAidValues>): void {
    const fill = change.fill;
    this.aids.set({
      ...(fill !== undefined
        ? aid === 'backdrop'
          ? { backdrop: fill as BackdropFill }
          : { standIn: fill as StandInFill }
        : {}),
      ...(change.colour !== undefined
        ? { [aid === 'backdrop' ? 'backdropColour' : 'standInColour']: change.colour }
        : {}),
      ...(change.sky !== undefined ? { backdropSky: change.sky } : {}),
      ...(change.gridSize !== undefined ? { gridSize: change.gridSize as GridSize } : {}),
    });
  }

  /** The selected layer, with the material it is a layer of. */
  protected readonly layer = computed(
    (): { readonly layer: LayerEntry; readonly material: MaterialEntry } | null => {
      const view = this.editor.materialView();
      const material = this.editor.material();
      const layer =
        view?.kind === 'layer' ? material?.layers.find((l) => l.slot === view.slot) : undefined;
      return material && layer ? { layer, material } : null;
    },
  );

  /** A layer's settings changed: its others, and the other layers', as set here, kept. */
  protected layerChange(slot: LayerSlot, change: Partial<LayerSettings>): void {
    const layers = this.editor.material()?.set?.layers ?? {};
    this.editor.setMaterial({ layers: { ...layers, [slot]: { ...layers[slot], ...change } } });
  }

  /** A layer's settings taken back; no layer's left set here: the layers as they are under it. */
  protected layerClear(slot: LayerSlot, keys: readonly (keyof LayerSettings)[]): void {
    const { [slot]: own, ...others } = this.editor.material()?.set?.layers ?? {};
    const kept = Object.fromEntries(
      Object.entries(own ?? {}).filter(([k]) => !keys.includes(k as keyof LayerSettings)),
    );
    const layers = Object.keys(kept).length ? { ...others, [slot]: kept } : others;
    if (Object.keys(layers).length) this.editor.setMaterial({ layers });
    else this.editor.clearMaterial(['layers']);
  }

  /** The selected material as the library has it (shared), opened from what it is selected in. */
  protected openShared(): void {
    const shared = this.editor.sharedMaterial();
    if (shared) this.ui.open(shared);
  }

  protected setReference(change: Partial<ReferenceValues>): void {
    const out: Partial<Record<keyof EditingAidsState, unknown>> = {};
    for (const [k, v] of Object.entries(change) as [keyof ReferenceValues, unknown][])
      out[this.referenceKeys[k]] = v;
    this.aids.set(out as Partial<EditingAidsState>);
  }

  protected clearReference(fields: readonly (keyof ReferenceValues)[]): void {
    this.aids.reset(fields.map((f) => this.referenceKeys[f]));
  }

  protected clearAid(
    aid: 'backdrop' | 'standIn',
    fields: readonly (keyof EditingAidValues)[],
  ): void {
    const keys: Partial<Record<keyof EditingAidValues, keyof EditingAidsState>> = this.keys[aid];
    this.aids.reset(fields.flatMap((f) => (keys[f] ? [keys[f]] : [])));
  }
}
