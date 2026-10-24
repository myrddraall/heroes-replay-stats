import type { Vec3 } from '../../../scenes/play-background/background-scene';
import { aimedPoint, aimOf, type LookAt } from '../../../scenes/play-background/look-at';
import { Component, computed, input, output } from '@angular/core';
import {
  type LightReach,
  type LightSettings,
  type Receiver,
  SHIELD_DEFAULTS,
} from '../../../scenes/play-background/scene-lights';
import { PropertyCheck } from '../properties/property-check';
import { PropertyColour } from '../properties/property-colour';
import { PropertyDirection } from '../properties/property-direction';
import { PropertyNumber } from '../properties/property-number';
import { type PlacementChange, PropertyPlacement } from '../properties/property-placement';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';
import type { LightEntry } from './editor-model';

/** A light's own settings (its name is apart, and its switch: the tree row's). */
const LIGHT_KEYS: readonly (keyof LightSettings)[] = [
  'darkens',
  'colour',
  'strength',
  'from',
  'softness',
  'specular',
  'specularStrength',
  'position',
  'placement',
  'orbitTurn',
  'fade',
  'lookAt',
  'aim',
  'cone',
  'edge',
  'ground',
  'wrap',
  'shield',
];

/** What a light does, as its Effect list offers it. */
const EFFECTS: readonly PropertyOption[] = [
  { value: 'lights', label: 'Lights' },
  { value: 'darkens', label: 'Darkens' },
];

/** What a spot light looks at, as its Aim list offers it. */
const AIMS: readonly PropertyOption[] = [
  { value: 'body', label: 'A spot on the planet' },
  { value: 'free', label: 'A direction' },
];

/** What a light reaches of its body, as its Reaches list offers it. */
type ReachMode = 'all' | LightReach['mode'];
const REACH_MODES: readonly PropertyOption[] = [
  { value: 'all', label: 'Everything' },
  { value: 'only', label: 'Only the checked' },
  { value: 'except', label: 'All but the checked' },
];

/**
 * A body's light's properties (presentational), the same rows for every light: whether it lights
 * or darkens (an antilight: its colour taken away, its strength how much), its colour and
 * strength, a directional light's side (Light from) and how softly it falls off round the body,
 * a point's or spot's place and reach (an environment light's: how far out the sky is read),
 * and one that lights its specular colour and strength (its shine on a material that shines);
 * what of its body it reaches (its parts and their materials, checked), and whether it reaches the
 * body's moons. Whether it is on is its row's checkbox in the tree.
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
    PropertyPlacement,
  ],
  templateUrl: './light-properties.html',
  styleUrl: './properties-panel.scss',
})
export class LightProperties {
  readonly light = input.required<LightEntry>();
  /** Whether it is one of a shield's lights: what it does to the grid is shown (its Shield section). */
  readonly onShield = input(false);
  readonly settingsChange = output<Partial<LightSettings>>();
  /** Settings set here to take back (none given: all of them). */
  readonly clear = output<readonly (keyof LightSettings)[] | undefined>();
  /** It was taken out (one added at the level edited). */
  readonly removed = output<void>();
  /** Its light's settings (its name is apart). */
  protected readonly lightKeys = LIGHT_KEYS;
  protected readonly effects = EFFECTS;
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

  /** Whether it is a directional, point or spot light: one with a shine. */
  protected readonly shiny = computed(() => {
    const k = this.light().light.kind;
    return k === 'directional' || k === 'point' || k === 'spot';
  });
  /** Whether it falls off across what it reaches (a Drop off): one with a shine, an environment light or a rim light. */
  protected readonly sided = computed(() => {
    const k = this.light().light.kind;
    return this.shiny() || k === 'environment' || k === 'rim';
  });
  /** What it does to a shield's grid, as set over what a shield's light does unless set. */
  protected readonly shield = computed(() => ({
    ...SHIELD_DEFAULTS,
    ...this.light().light.shield,
  }));

  protected shieldChange(change: Partial<typeof SHIELD_DEFAULTS>): void {
    this.settingsChange.emit({ shield: { ...this.light().light.shield, ...change } });
  }

  protected readonly aims = AIMS;
  /** What a spot light looks at: a spot on its planet (unless aimed along a direction, as set or kept from before). */
  protected readonly aimKind = computed((): LookAt['kind'] => {
    const l = this.light().light;
    return (l.lookAt?.kind ?? (l.aim ? 'free' : 'body')) as LookAt['kind'];
  });
  /** The spot on its planet's face a spot light is aimed at (aimed at the middle: the face nearest it). */
  protected readonly aimedPoint = computed((): Vec3 => {
    const l = this.light().light;
    return aimedPoint(l.position ?? [0, -2.5, 1.5], l.lookAt);
  });
  /** The way a spot light points. */
  protected readonly aimDirection = computed((): Vec3 => {
    const l = this.light().light;
    return aimOf(l.position ?? [0, -2.5, 1.5], l.lookAt, l.aim);
  });

  /** A spot light's aim switched between a spot on its planet and a direction (the one it points along now). */
  protected chooseAim(kind: string): void {
    const lookAt: LookAt =
      kind === 'free'
        ? { kind: 'free', direction: this.aimDirection() }
        : { kind: 'body', at: this.aimedPoint() };
    this.settingsChange.emit({ lookAt });
  }

  protected aimAt(at: Vec3): void {
    this.settingsChange.emit({ lookAt: { kind: 'body', at } });
  }

  protected aimAlong(direction: Vec3): void {
    this.settingsChange.emit({ lookAt: { kind: 'free', direction } });
  }

  /** A point or spot light placed: where it is, how it is set, the turn of the orbit it is on (where it changed). */
  protected place(change: PlacementChange): void {
    const l = this.light().light;
    this.settingsChange.emit({
      position: change.position,
      ...(change.mode ? { placement: change.mode } : {}),
      ...(change.orbit.turn !== (l.orbitTurn ?? 0) ? { orbitTurn: change.orbit.turn } : {}),
    });
  }
}
