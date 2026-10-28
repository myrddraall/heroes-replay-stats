import {
  LIGHT_KIND_NAMES,
  type LightOut,
  type LightReach,
  type LightSettings,
  SHIELD_DEFAULTS,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import {
  aimedPoint,
  aimOf,
  type LookAt,
  type Vec3,
} from '@myrddraall/heroes-replay-stats-aether/space';
import { Component, computed, input, output } from '@angular/core';
import { PropertyCheck } from '../controls/rows/property-check';
import { PropertyColour } from '../controls/rows/property-colour';
import { PropertyDirection } from '../controls/rows/property-direction';
import { PropertyNumber } from '../controls/rows/property-number';
import { type PlacementChange, PropertyPlacement } from '../controls/rows/property-placement';
import { type PropertyOption, PropertySelect } from '../controls/rows/property-select';
import { PropertySection } from '../controls/property-section';
import { PropertyText } from '../controls/rows/property-text';
import type { LightEntry } from './lights';
import { LightLinking } from './light-linking';
import type { LinkChange, LinkEntry } from './linking';
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

/** What else a light lights, as its Also lights list offers it (those its body can: see `LightEntry`). */
const OUT_LABELS: Record<LightOut, string> = {
  none: 'Nothing else',
  planet: 'Its planet',
  group: 'Its group',
  scene: 'The whole scene',
};

/**
 * A body's light's properties (presentational), the same rows for every light: whether it lights
 * or darkens (its colour taken away, its strength how much), its colour and
 * strength, a directional light's side (Light from) and how softly it falls off round the body,
 * a point's or spot's place and reach (an environment light's: how far out the sky is read),
 * and one that lights its specular colour and strength (its shine on a material that shines);
 * what of its body it reaches (its parts and their materials, checked), whether it lights the
 * body's moons and what else it lights. Whether it is on is its row's checkbox in the tree.
 */
@Component({
  selector: 'forge-light-properties',
  imports: [
    PropertySection,
    PropertyColour,
    PropertyNumber,
    PropertyDirection,
    PropertyText,
    PropertySelect,
    PropertyCheck,
    PropertyPlacement,
    LightLinking,
  ],
  templateUrl: './light-properties.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class LightProperties {
  /** The page of the panel shown (see `panelPagesOf`): its settings alone; none, all of them. */
  readonly page = input('');

  readonly light = input.required<LightEntry>();
  /** Whether it is one of a shield's lights: what it does to the grid is shown (its Shield section). */
  readonly onShield = input(false);
  /** What it lights, as its Linking lists it (none: nothing listed: a shield's light, the stand-in's). */
  readonly links = input<readonly LinkEntry[]>([]);
  readonly settingsChange = output<Partial<LightSettings>>();
  /** Something it lights taken in or left out, or what is set of it here reset. */
  readonly linkChange = output<LinkChange>();
  readonly linkReset = output<string>();
  /** Settings set here to take back (none given: all of them). */
  readonly clear = output<readonly (keyof LightSettings)[] | undefined>();
  /** It was taken out (one added at the level edited). */
  readonly removed = output<void>();
  /** Its light's settings (its name is apart). */
  protected readonly lightKeys = LIGHT_KEYS;
  protected readonly effects = EFFECTS;
  protected readonly changed = computed(() => LIGHT_KEYS.some((k) => this.isSet(k)));
  /** What kind of light it is (whether it darkens is its Effect). */
  protected readonly kindName = computed(() => LIGHT_KIND_NAMES[this.light().light.kind]);

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

  /** Its own body, where its Linking lists it: how what it reaches of it is named is set too. */
  protected readonly ownLink = computed(() => this.links().some((l) => l.own));

  protected readonly outOptions = computed((): PropertyOption[] =>
    (['none', ...this.light().outs] as const).map((value) => ({
      value,
      label: OUT_LABELS[value],
    })),
  );

  /** What else it lights chosen: nothing, as it starts (one set under it: nothing over that). */
  protected chooseOut(value: string): void {
    if (value !== 'none') this.settingsChange.emit({ out: value as LightOut });
    else if (this.light().removable || !this.light().origins.out) this.unset(['out']);
    else this.settingsChange.emit({ out: 'none' });
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

  /** Whether a page's settings show: the page shown, or every page where none is. */
  protected on(id: string): boolean {
    const p = this.page();
    return !p || p === id;
  }
}
