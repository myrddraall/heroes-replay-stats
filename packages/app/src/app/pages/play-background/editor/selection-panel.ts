import { Component, computed, inject } from '@angular/core';
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
import { MaterialProperties } from './material-properties';
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
      onPlanet: 'materialOnPlanet',
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
    onPlanet: this.aids.materialOnPlanet(),
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
      return !!key && this.aids[key]() !== EDITING_AIDS_DEFAULTS[key];
    };
    return {
      fill: differs('fill'),
      sky: differs('sky'),
      colour: differs('colour'),
      gridSize: differs('gridSize'),
      onPlanet: differs('onPlanet'),
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
      ...(change.onPlanet !== undefined ? { materialOnPlanet: change.onPlanet } : {}),
    });
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
