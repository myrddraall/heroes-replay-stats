import { Component, computed, input, output } from '@angular/core';
import type { Vec3 } from '../../../scenes/play-background/scene-directions';
import type {
  LightReach,
  LightSettings,
  Receiver,
} from '../../../scenes/play-background/scene-lights';
import { PropertyCheck } from '../properties/property-check';
import { PropertyColour } from '../properties/property-colour';
import { PropertyDirection } from '../properties/property-direction';
import { PropertyNumber } from '../properties/property-number';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';
import type { LightEntry } from './editor-model';

/** A light's own settings (its name is apart, and its switch: the tree row's). */
const LIGHT_KEYS: readonly (keyof LightSettings)[] = [
  'colour',
  'strength',
  'from',
  'softness',
  'spread',
  'falloff',
  'energizes',
  'glow',
  'tied',
];

/** What a light reaches of its body, as its Reaches list offers it. */
type ReachMode = 'all' | LightReach['mode'];
const REACH_MODES: readonly PropertyOption[] = [
  { value: 'all', label: 'Everything' },
  { value: 'only', label: 'Only the checked' },
  { value: 'except', label: 'All but the checked' },
];

/**
 * A body's light's properties (presentational), the same rows for every light: its colour and
 * strength (an ambient light's from all round, a directional light's from a side, Light from); a
 * shadow's strength (how dark), the side it darkens from and how softly; what of its body it
 * reaches (its parts and their materials, checked), and whether it reaches the body's moons. Whether
 * it is on is its row's checkbox in the tree.
 */
@Component({
  selector: 'hrs-light-properties',
  imports: [
    PropertySection,
    PropertyColour,
    PropertyNumber,
    PropertyDirection,
    PropertyText,
    PropertySelect,
    PropertyCheck,
  ],
  templateUrl: './light-properties.html',
  styleUrl: './properties-panel.scss',
})
export class LightProperties {
  readonly light = input.required<LightEntry>();
  readonly settingsChange = output<Partial<LightSettings>>();
  /** Settings set here to take back (none given: all of them). */
  readonly clear = output<readonly (keyof LightSettings)[] | undefined>();
  /** It was taken out (one added at the level edited). */
  readonly removed = output<void>();
  /** An activation light tied to its body's reveal light turned: the reveal light turned (both move). */
  readonly tiedFromChange = output<Vec3>();
  /** Its light's settings (its name is apart). */
  protected readonly lightKeys = LIGHT_KEYS;
  protected readonly changed = computed(() => LIGHT_KEYS.some((k) => this.isSet(k)));

  /**
   * Renamed: one added at the level edited, its own name; else over its name under the level
   * edited (left empty, back to it).
   */
  protected rename(value: string): void {
    const name = value.trim();
    if (name) this.settingsChange.emit({ name });
    else if (!this.light().removable) this.clear.emit(['name']);
  }

  protected readonly reachModes = REACH_MODES;
  /** What it reaches, as the list shows it (all but nothing: everything). */
  protected readonly reachMode = computed((): ReachMode => {
    const r = this.light().reach;
    return !r || (r.mode === 'except' && !r.receivers.length) ? 'all' : r.mode;
  });

  protected chooseReach(mode: string): void {
    const now = this.light().reach;
    if (mode === 'only' || mode === 'except')
      this.settingsChange.emit({ reach: { mode, receivers: now?.receivers ?? [] } });
    // Everything: back to what is under it where that reaches everything, else all but nothing.
    else if (this.light().removable || !this.light().origins.reach) this.unset(['reach']);
    else this.settingsChange.emit({ reach: { mode: 'except', receivers: [] } });
  }

  protected checkReceiver(receiver: Receiver, checked: boolean): void {
    const r = this.light().reach;
    if (!r) return;
    const receivers = checked
      ? [...r.receivers, receiver]
      : r.receivers.filter((x) => x !== receiver);
    this.settingsChange.emit({ reach: { mode: r.mode, receivers } });
  }

  /** Settings taken back: one added at the level edited has its own, taken out of it. */
  protected unset(keys: readonly (keyof LightSettings)[]): void {
    if (this.light().removable)
      this.settingsChange.emit(Object.fromEntries(keys.map((k) => [k, undefined])));
    else this.clear.emit(keys);
  }

  protected isSet(key: keyof LightSettings): boolean {
    return this.light().set?.[key] !== undefined;
  }
}
