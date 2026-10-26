import { Component, computed, input, output } from '@angular/core';
import type { LayerSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import { PropertyCheck } from '../../controls/rows/property-check';
import { PropertyNumber } from '../../controls/rows/property-number';
import { PropertySection } from '../../controls/property-section';
import { PropertyText } from '../../controls/rows/property-text';
import { type PropertyOption, PropertySelect } from '../../controls/rows/property-select';
import type { LayerEntry } from '../../editing/model/materials';
/** A pair's two halves, as their rows name them. */
const HALVES = ['U', 'V'] as const;

/**
 * A material layer's properties (presentational), in a section of its own: the texture it reads
 * (any loaded with what it is drawn on), and how that lies on it: moved, turned, repeated,
 * scrolled, and whether it repeats or stops at its edges, across u and v each; then where the site
 * and the game data have the texture. Its section starts folded unless something of it is set here.
 */
@Component({
  selector: 'forge-layer-properties',
  imports: [PropertySection, PropertySelect, PropertyNumber, PropertyCheck, PropertyText],
  templateUrl: './layer-properties.html',
  styleUrl: '../../panel/properties-panel.scss',
})
export class LayerProperties {
  readonly layer = input.required<LayerEntry>();
  /** Where the game data is served (the texture linked under it). */
  readonly dataUrl = input.required<string>();
  /** Whether its transforms do anything (a particle system's texture only shows as it is). */
  readonly transforms = input(true);
  /** Whether its section starts open (selected on its own); else only while something of it is set here. */
  readonly open = input(false);
  readonly settingsChange = output<Partial<LayerSettings>>();
  /** Settings set here to take back (all of them: the layer as it is under the level edited). */
  readonly clear = output<readonly (keyof LayerSettings)[]>();
  protected readonly halves = HALVES;
  protected readonly options = computed((): PropertyOption[] =>
    this.layer().choices.map((c) => ({ value: c.key, label: c.label })),
  );
  protected readonly changed = computed(() => Object.keys(this.layer().set ?? {}).length > 0);

  protected isSet(key: keyof LayerSettings): boolean {
    return this.layer().set?.[key] !== undefined;
  }

  /** One half of a pair changed: the pair with the other half as it is. */
  protected half<K extends 'offset' | 'tiling' | 'scroll' | 'wrap'>(
    key: K,
    i: number,
    value: NonNullable<LayerSettings[K]>[number],
  ): void {
    const pair = [...this.layer().values[key]];
    pair[i] = value;
    this.settingsChange.emit({ [key]: pair } as Partial<LayerSettings>);
  }

  /** Renamed here; left empty, back to its name under the level edited. */
  protected rename(value: string): void {
    const label = value.trim();
    if (label) this.settingsChange.emit({ label });
    else this.clear.emit(['label']);
  }

  protected all(): (keyof LayerSettings)[] {
    return Object.keys(this.layer().set ?? {}) as (keyof LayerSettings)[];
  }
}
