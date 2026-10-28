import { Component, computed, inject } from '@angular/core';
import { DATA_URL } from '@myrddraall/heroes-replay-stats-aether';
import type { LayerSettings, LayerSlot } from '@myrddraall/heroes-replay-stats-aether/materials';
import {
  type AddedLight,
  addedLight,
  type LightId,
  type LightSettings,
  newLight,
  type NewLightKind,
  withLightChanged,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { type AddedItem, AddedList } from '../controls/added-list';
import { PropertySection } from '../controls/property-section';
import { Editor } from '../editing/editor';
import { PanelPagesStore } from './panel-pages.store';
import { type LightEntry, lightIcon } from '../lights/lights';
import type { LayerEntry, MaterialEntry } from '../materials/materials';
import { splitViewKey, viewKey } from '../materials/material-views';
import { EditorUiStore } from '../layout/editor-ui.store';
import { AddLight } from '../lights/add-light';
import { LightProperties } from '../lights/light-properties';
import { LitBy } from '../lights/lit-by';
import { LayerProperties } from '../materials/layer-properties';
import { MaterialProperties } from '../materials/material-properties';
import { PatternProperties } from '../materials/pattern-properties';

/**
 * A material's properties in the selection panel (container, on the `Editor` in effect): the
 * material's own, a sky's material's, its shader's (a shield's pattern and lights), one of the
 * shield's lights, or one of its layers.
 */
@Component({
  selector: 'forge-material-panel',
  imports: [
    AddedList,
    AddLight,
    LayerProperties,
    LightProperties,
    LitBy,
    MaterialProperties,
    PatternProperties,
    PropertySection,
  ],
  templateUrl: './material-panel.html',
  styleUrl: './material-panel.scss',
})
export class MaterialPanel {
  protected readonly editor = inject(Editor);
  protected readonly pages = inject(PanelPagesStore);
  private readonly ui = inject(EditorUiStore);
  /** Where the game data is served (textures linked under it). */
  protected readonly dataUrl = inject(DATA_URL);

  /** The shield shader's lights (the selected shader's, or the selected light's shader's), as rows of its Lights. */
  protected readonly shieldLights = computed((): readonly AddedItem[] => {
    const base = splitViewKey(this.editor.selected())?.base;
    const lights = this.editor.material()?.values.gridLights ?? [];
    return base
      ? lights.map((l) => ({
          key: viewKey(base, { kind: 'gridLight', id: l.id }),
          label: l.name,
          icon: lightIcon(l),
          removable: true,
        }))
      : [];
  });

  /**
   * The selected shield light, where one is, as the light panel shows a light: its own settings
   * (set here, nothing under it), a rim light's lean, spread and falloff filled in with the
   * material's own where it sets none.
   */
  protected readonly gridLight = computed((): LightEntry | null => {
    const view = this.editor.materialView();
    const m = this.editor.material();
    const l =
      view?.kind === 'gridLight' ? m?.values.gridLights.find((l) => l.id === view.id) : null;
    if (!l || !m) return null;
    const light = addedLight(l);
    const rim =
      l.kind === 'rim'
        ? {
            from: l.from ?? m.values.spreadFrom,
            fade: l.fade ?? m.values.spread,
            softness: l.softness ?? m.values.falloff,
          }
        : {};
    // (Set here: a rim light's lean, spread and falloff where set over the material's; the rest
    // is the light's own, nothing under it to go back to.)
    const set: LightSettings | undefined =
      l.kind === 'rim' && (l.from || l.fade !== undefined || l.softness !== undefined)
        ? {
            ...(l.from ? { from: l.from } : {}),
            ...(l.fade !== undefined ? { fade: l.fade } : {}),
            ...(l.softness !== undefined ? { softness: l.softness } : {}),
          }
        : undefined;
    return {
      light: { ...light, ...rim },
      nameBelow: l.name,
      enabledBelow: true,
      set,
      origins: {},
      removable: true,
      receivers: [],
      down: false,
      canDown: false,
      outs: [],
    };
  });

  /** A light added to the shield shader (its lights set at the level edited), and selected. */
  protected addGridLight(kind: NewLightKind): void {
    const base = splitViewKey(this.editor.selected())?.base;
    const lights = this.editor.material()?.values.gridLights ?? [];
    if (!base) return;
    const light = newLight(kind, lights);
    this.editor.setMaterial({ gridLights: [...lights, light] });
    this.editor.select(viewKey(base, { kind: 'gridLight', id: light.id }));
  }

  /** One of the shield shader's lights changed (its lights set at the level edited). */
  protected changeGridLight(id: LightId, change: Partial<LightSettings>): void {
    const lights = this.editor.material()?.values.gridLights ?? [];
    this.editor.setMaterial({
      gridLights: withLightChanged(lights, id as AddedLight['id'], change),
    });
  }

  /** A shield light's settings taken back (all of them, or those named): unset, back to its kind's own. */
  protected cleared(keys: readonly (keyof LightSettings)[] | undefined): Partial<LightSettings> {
    const all: readonly (keyof LightSettings)[] = keys ?? [
      'from',
      'fade',
      'softness',
      'wrap',
      'shield',
    ];
    return Object.fromEntries(all.map((k) => [k, undefined]));
  }

  /** One of the shield shader's lights taken out; it selected: the shader selected instead. */
  protected removeGridLight(key: string): void {
    const split = splitViewKey(key);
    if (!split || split.view === 'group' || split.view.kind !== 'gridLight') return;
    const id = split.view.id;
    const lights = this.editor.material()?.values.gridLights ?? [];
    this.editor.setMaterial({ gridLights: lights.filter((l) => l.id !== id) });
    if (this.editor.selected() === key) this.editor.select(viewKey(split.base, { kind: 'shader' }));
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

  protected openShared(): void {
    const shared = this.editor.sharedMaterial();
    if (shared) this.ui.open(shared);
  }
}
