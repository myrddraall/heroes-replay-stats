import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { type PropertyOption, PropertySelect } from '../controls/rows/property-select';
import { Editor } from '../editing/editor';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import { TintSection } from '../materials/tint-section';
import {
  EditingAidProperties,
  type EditingAidChanged,
  type EditingAidValues,
} from './editing-aid-properties';
import {
  EDITING_AIDS_DEFAULTS,
  type EditingAidsState,
  EditingAidsStore,
} from './editing-aids.store';
import type { PreviewSetup } from './preview-setup';
import { ReferenceProperties, type ReferenceValues } from './reference-properties';

/**
 * The editing aids' properties in the selection panel (container, on the page's aids store and
 * the `Editor` in effect: never the design): the item open's Preview stage (its backdrop, a sky's
 * tint and reset where it is a sky; its stand-in planet, or the planet an overlay is worn by; put
 * back as its kind has it, or made its kind's), and the reference image.
 */
@Component({
  selector: 'forge-aids-panel',
  imports: [
    EditingAidProperties,
    NgTemplateOutlet,
    PropertySelect,
    ReferenceProperties,
    TintSection,
  ],
  templateUrl: './aids-panel.html',
  styleUrl: './aids-panel.scss',
})
export class AidsPanel {
  protected readonly editor = inject(Editor);
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

  /** The aids' properties, each aid's under the same names: by their names in a Preview stage. */
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
  } as const satisfies Record<string, Partial<Record<keyof EditingAidValues, keyof PreviewSetup>>>;

  /** The planets an overlay can be shown worn by on its Preview stage: the stand-in, or one of the library's. */
  protected readonly planets = computed((): PropertyOption[] => [
    { value: '', label: 'Stand-in' },
    ...this.catalog.planets().map((p) => ({ value: p.id, label: p.id })),
  ]);
  /** Whether the item open is an overlay (it can be shown worn by another planet). */
  protected readonly worn = computed(() => this.editor.opened().kind === 'style');

  protected readonly backdrop = computed((): EditingAidValues | null => {
    const p = this.editor.preview();
    return (
      p && { fill: p.backdrop, sky: p.backdropSky, colour: p.backdropColour, gridSize: p.gridSize }
    );
  });
  protected readonly standIn = computed((): EditingAidValues | null => {
    const p = this.editor.preview();
    return p && { fill: p.standIn, colour: p.standInColour, gridSize: p.gridSize };
  });
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
  /** Whether the item open sets anything of its Preview stage itself. */
  protected readonly previewSet = computed(() => Object.keys(this.editor.previewOwn()).length > 0);

  /** Which of an aid's settings the item open sets itself (the others as its kind has them). */
  private changedOf(aid: 'backdrop' | 'standIn'): EditingAidChanged {
    const keys: Partial<Record<keyof EditingAidValues, keyof PreviewSetup>> = this.keys[aid];
    const own = this.editor.previewOwn();
    const set = (k: keyof EditingAidValues) => {
      const key = keys[k];
      return !!key && key in own;
    };
    return { fill: set('fill'), sky: set('sky'), colour: set('colour'), gridSize: set('gridSize') };
  }

  /** Some of an aid's settings set for the item open. */
  protected setAid(aid: 'backdrop' | 'standIn', change: Partial<EditingAidValues>): void {
    const keys: Partial<Record<keyof EditingAidValues, keyof PreviewSetup>> = this.keys[aid];
    const out: Partial<Record<keyof PreviewSetup, unknown>> = {};
    for (const [k, v] of Object.entries(change) as [keyof EditingAidValues, unknown][]) {
      const key = keys[k];
      if (key && v !== undefined) out[key] = v;
    }
    this.editor.setPreview(out as Partial<PreviewSetup>);
  }

  /** The planet the overlay open is shown worn by ('': the stand-in). */
  protected setPlanet(planet: string): void {
    this.editor.setPreview({ planet: planet || null });
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
    const keys: Partial<Record<keyof EditingAidValues, keyof PreviewSetup>> = this.keys[aid];
    this.editor.clearPreview(fields.flatMap((f) => (keys[f] ? [keys[f]] : [])));
  }
}
