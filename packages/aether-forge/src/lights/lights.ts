import {
  type BodyPath,
  legacyShadow,
  withLightSetting,
  withLightSwitched,
  without,
  withoutLightSetting,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { DEFAULT_SHADE, wearOf } from '@myrddraall/heroes-replay-stats-aether/formats';
import {
  addedLight,
  type AddedLight,
  type BodyLight,
  bodyLights,
  knownLights,
  type LightId,
  type LightKind,
  LIGHT_KIND_NAMES,
  type LightReach,
  type LightSettings,
  type LightSettingsMap,
  downOf,
  type LightOut,
  lightsOut,
  mergeLightSettings,
  type PartMaterials,
  reachesReceiver,
  type Receiver,
  tunedRig,
  withReceiver,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { materialKey } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { Viewpoint } from '@myrddraall/heroes-replay-stats-aether/space';
import {
  type BodyInfo,
  bodyOrigins,
  overlayLabel,
  overridesOf,
  ownLevels,
  rigOf,
  valuesOf,
} from '../bodies/body';
import { type PartNode, partNodes, partsOfBody } from '../parts/parts';
import { type MaterialEntry, materialsOf, onPart, sharedMaterials } from '../materials/materials';
import { viewKey } from '../materials/material-views';
import { originsOf, type SettingOrigins } from '../editing/setting-origins';
import type { AddedItem } from '../controls/added-list';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';
/** A body's and a scene's lights as an editor shows them, what lights each body, and the shield's lights. */

/** Each kind of light's icon (whether it darkens or lights, the same). */
export const LIGHT_ICONS: Record<LightKind, string> = {
  ambient: 'brightness_low',
  directional: 'wb_sunny',
  point: 'flare',
  spot: 'highlight',
  hemisphere: 'wb_twilight',
  environment: 'lens_blur',
  rim: 'blur_circular',
};

/** A light's icon in the tree: by its kind. */
export const lightIcon = (l: { readonly kind: LightKind }): string => LIGHT_ICONS[l.kind];

/**
 * What a light is, as its tree row says it beside its name (none where its name says it already:
 * "Spot light 2"); with the overlay it is of, where it is one's.
 */
export function lightDetail(
  light: { readonly kind: LightKind; readonly name: string },
  overlay?: string,
): string | undefined {
  const kind = LIGHT_KIND_NAMES[light.kind];
  const parts = [
    ...(light.name.toLowerCase().startsWith(kind.toLowerCase()) ? [] : [kind]),
    ...(overlay ? [overlay] : []),
  ];
  return parts.length ? parts.join(' · ') : undefined;
}

/** A body's light as its properties show it. */
export interface LightEntry {
  /** Which level over the one edited wins for each of its settings, where one sets it. */
  readonly overrides?: SettingOrigins<keyof LightSettings>;
  readonly light: BodyLight;
  /** Its name as the levels under the one edited have it (one added here: its own). */
  readonly nameBelow: string;
  /**
   * Whether it is on as the levels under the one edited have it (one added here: on), so switched
   * so here is nothing set.
   */
  readonly enabledBelow: boolean;
  /** What of it is set in the layer edited (the shadow's, as set before lights were objects too). */
  readonly set: LightSettings | undefined;
  /** Which level under the one edited sets each of its settings, where one does. */
  readonly origins: SettingOrigins<keyof LightSettings>;
  /** Whether it was added at the level edited (so it can be taken out there; its settings are its own). */
  readonly removable: boolean;
  /** Where it was added, where that is a level under the one edited (an overlay's, the library's). */
  readonly addedIn?: string;
  /** The overlay the body wears it is of, by id (shown under the overlay); none: the body's. */
  readonly overlay?: string;
  /** What of its body it reaches (none: everything). */
  readonly reach?: LightReach;
  /**
   * Whether it lights its body's moons too (Down), and whether it can (a body's own, with moons);
   * what else it lights (Out: its planet, its group, the whole scene; none: nothing), and what it
   * can (a body's own: the whole scene, a moon's its planet too; none, a scene's or a shield's).
   */
  readonly down: boolean;
  readonly canDown: boolean;
  readonly out?: LightOut;
  readonly outs: readonly Exclude<LightOut, 'none'>[];
}

/** A part or material a body's light may reach, as its Reaches list shows it (a part, its materials under it). */
export interface ReceiverEntry {
  readonly receiver: Receiver;
  readonly label: string;
  readonly material: boolean;
}

/** What a body's lights may reach: its parts, each with the materials drawn on it (its overlays' named so). */
export function receiversOf(b: BodyInfo): ReceiverEntry[] {
  const nodes = partNodes(b, materialsOf(b));
  const named = (id: string | undefined) => {
    const o = b.overlays.find((x) => x.id === id);
    return o ? ` (${overlayLabel(o)})` : '';
  };
  return [...nodes.own, ...nodes.overlays.flatMap((o) => o.nodes)].flatMap(
    ({ part, materials }) => [
      {
        receiver: `part:${part.key}` as const,
        label: part.label + named(part.overlay),
        material: false,
      },
      ...materials.map((m) => ({
        receiver: `material:${m.key}` as const,
        label: m.label,
        material: true,
      })),
    ],
  );
}

/**
 * A body's lights as shown (see `bodyLights`): its rig as it is turned (Light from) with each
 * light's settings in effect over it, and its shadow as its shade comes to; what the layer edited
 * sets of each, and which level under it sets the rest.
 */
export function lightsOfBody(b: BodyInfo): LightEntry[] {
  const values = valuesOf(b);
  const rig = rigOf(b);
  // Its lights as they start: its rig as tuned (turned and made stronger together).
  const turned = rig && tunedRig(rig, values.lighting, values.lightFrom ?? undefined);
  const softness = b.overlays.reduce(
    (a, o) => ({ ...a, ...o.file?.shade, ...wearOf(b.file, o.id)?.shade }),
    { ...DEFAULT_SHADE, ...b.file?.tuning?.shade },
  ).softness;
  const shade = { strength: values.shade, direction: values.shadeTowards, softness };
  // The overlays' (shared, the later over the earlier), then its own.
  const levels: [string, LightSettingsMap | undefined][] = [
    ...b.overlays.map((o): [string, LightSettingsMap | undefined] => [
      `the library (${overlayLabel(o)})`,
      o.below?.lights,
    ]),
    ...ownLevels(b).map((l): [string, LightSettingsMap | undefined] => [
      l.name,
      l.settings?.lights,
    ]),
  ];
  const settings = mergeLightSettings(...levels.map(([, l]) => l), b.settings.lights);
  const under = mergeLightSettings(...levels.map(([, l]) => l));
  const lightsBelow = new Map(bodyLights(turned, shade, under).map((l) => [l.id, l]));
  const body = bodyOrigins(b);
  // The lights added to it: under the level edited (the library's for the planet, its overlay's),
  // then the level edited's own (its settings are its own: nothing over them here).
  const below: [string, readonly AddedLight[] | undefined, string | undefined][] = [
    ...ownLevels(b).map((l): [string, readonly AddedLight[] | undefined, undefined] => [
      l.name,
      l.settings?.added,
      undefined,
    ]),
    ...b.overlays.map((o): [string, readonly AddedLight[] | undefined, string] => [
      `the ${overlayLabel(o)} overlay`,
      o.below?.added,
      o.id,
    ]),
  ];
  const added: Omit<LightEntry, 'down' | 'canDown' | 'out' | 'outs'>[] = [
    ...below.flatMap(([name, list, overlay]) =>
      knownLights(list ?? []).map((l) => ({
        ...(overlay ? { overlay } : {}),
        light: addedLight(l, settings[l.id]),
        nameBelow: addedLight(l, under[l.id]).name,
        enabledBelow: addedLight(l, under[l.id]).enabled,
        set: b.settings.lights?.[l.id],
        origins: originsOf(levels.map(([level, s]) => [level, s?.[l.id]] as const)),
        overrides: overridesOf(b, (s) => s?.lights?.[l.id]),
        removable: false,
        addedIn: name,
      })),
    ),
    ...knownLights(b.settings.added ?? []).map((l) => ({
      light: addedLight(l),
      nameBelow: l.name,
      enabledBelow: true,
      set: undefined,
      origins: {},
      overrides: overridesOf(b, (s) => s?.lights?.[l.id]),
      removable: true,
    })),
  ];
  // What each reaches (as set over an added light's own), and what beyond its body.
  const outs: readonly Exclude<LightOut, 'none'>[] = b.orbit ? ['planet', 'scene'] : ['scene'];
  const addedById = new Map(
    [...addedBelowOf(b), ...(b.settings.added ?? [])].map((l) => [l.id, l] as const),
  );
  return [...rigEntries(), ...added].map((e) => {
    const own = addedById.get(e.light.id as `added-${string}`);
    const merged = { ...own, ...settings[e.light.id] };
    return {
      ...e,
      reach: merged.reach,
      down: downOf(merged),
      canDown: b.moons.length > 0,
      ...(merged.out ? { out: merged.out } : {}),
      outs,
    };
  });

  function rigEntries(): Omit<LightEntry, 'down' | 'canDown' | 'out' | 'outs'>[] {
    return bodyLights(turned, shade, settings).map((light) => {
      const shadow = light.id === 'shadow';
      const own = b.settings.lights?.[light.id];
      const set = shadow ? { ...legacyShadow(b.settings), ...own } : own;
      const origins = originsOf(levels.map(([name, l]) => [name, l?.[light.id]] as const));
      return {
        light,
        nameBelow: lightsBelow.get(light.id)?.name ?? light.name,
        enabledBelow: lightsBelow.get(light.id)?.enabled ?? true,
        set: set && Object.keys(set).length ? set : undefined,
        origins: shadow ? { strength: body.shade, from: body.shadeTowards, ...origins } : origins,
        overrides: overridesOf(b, (s) => s?.lights?.[light.id]),
        removable: false,
      };
    });
  }
}

/**
 * A body's lights that light beyond it (`lightsOut`): those added to it (the library's, its
 * overlays', its own) and its data's, as set; its data's under ids of its own (`handedOnId`).
 */
export function lightsOutOf(b: BodyInfo): AddedLight[] {
  const rig = lightsOfBody(b)
    .filter((e) => !e.light.id.startsWith('added-'))
    .map((e) => e.light);
  return lightsOut(
    b.id,
    rig,
    [...addedBelowOf(b), ...(b.settings.added ?? [])],
    mergeLightSettings(lightsBelowOf(b), b.settings.lights),
  );
}

/** The lights added to a body under the level edited: the library's for it, then its overlays'. */
const addedBelowOf = (b: BodyInfo): AddedLight[] => [
  ...ownLevels(b).flatMap((l) => l.settings?.added ?? []),
  ...b.overlays.flatMap((o) => o.below?.added ?? []),
];

/** What is set for a body's lights under the level edited: its overlays', then the library's for it. */
const lightsBelowOf = (b: BodyInfo) =>
  mergeLightSettings(
    ...b.overlays.map((o) => o.below?.lights),
    ...ownLevels(b).map((l) => l.settings?.lights),
  );

/**
 * A scene's own lights as shown: each added to the scene (its settings its own); a group's, those
 * that may light the whole scene it is put in too (`outs`).
 */
export function sceneLightsOf(
  lights: readonly AddedLight[] | undefined,
  outs: readonly Exclude<LightOut, 'none'>[] = [],
): LightEntry[] {
  return knownLights(lights ?? []).map((l) => ({
    light: addedLight(l),
    nameBelow: l.name,
    enabledBelow: true,
    set: undefined,
    origins: {},
    down: false,
    canDown: false,
    ...(l.out ? { out: l.out } : {}),
    outs,
    removable: true,
  }));
}

/**
 * A light from beyond a body that lights it too (its scene's, a planet's it is a moon of), and
 * whose it is (the scene, or the planet: its path, and whether its overlay's).
 */
export interface OuterLight {
  readonly light: AddedLight;
  readonly owner: BodyPath | 'scene';
  /** The overlay of the planet it is of, by id, where it is an overlay's. */
  readonly overlay?: string;
  /** What it is of, by name: the scene, or the body (see `LitByEntry`). */
  readonly from?: string;
}

/** A light that may light what is selected (a body, a part, a material), as its Lit by list shows it. */
export interface LitByEntry {
  readonly id: LightId;
  readonly kind: LightKind;
  readonly name: string;
  /** Whether it darkens instead of lighting. */
  readonly darkens: boolean;
  /** Whether it lights it (a body: whether it is on for it). */
  readonly reaches: boolean;
  /** Whether it is on as the levels under the one edited have it. */
  readonly enabledBelow: boolean;
  /** What of the body it reaches, as in effect and as under the level edited. */
  readonly reach?: LightReach;
  readonly reachBelow?: LightReach;
  /**
   * Whose it is, to find it in the tree: the body's own (none), the scene's, or a planet's it is a
   * moon of (its path); and the overlay it is of, where it is one's (shown under the overlay).
   */
  readonly owner?: BodyPath | 'scene';
  readonly overlay?: string;
  /** What it is of, by name, where not the body's own: the scene, or another body. */
  readonly from?: string;
  /** Whether it was added at the level edited, to the body (it can be taken out here). */
  readonly removable?: boolean;
}

/** A body's parts' materials (by `materialKey`), by part (its overlays' too). */
function partMaterialsOf(b: BodyInfo): PartMaterials {
  const opened = b.file?.kind === 'style' ? b.id : undefined;
  return new Map(
    partsOfBody(b).map((p) => [
      p.key as string,
      p.materials.map((name) => materialKey(name, p.overlay ?? opened)),
    ]),
  );
}

/**
 * What lights a body (`receiver` none), one of its parts or one of its materials: each of its
 * lights (its own, its overlay's, the library's) and those from beyond it (`outer`) of a kind that
 * acts on what of it is selected (ambient, directional and shadow lights on a lit material; reveal
 * and activation lights on a grid). A body's list has each whether on or off for it; a part's or
 * material's, each on, and whether it reaches it.
 */
export function litByOf(
  b: BodyInfo,
  receiver: Receiver | null,
  outer: readonly OuterLight[] = [],
): LitByEntry[] {
  const materials = materialsOf(b);
  const parts = partMaterialsOf(b);
  const shown = materials.filter((m) =>
    receiver === null
      ? true
      : receiver.startsWith('part:')
        ? (parts.get(receiver.slice(5)) ?? []).includes(m.key)
        : receiver === `material:${m.key}`,
  );
  // Lights light a lit material; one that darkens darkens any of a body's.
  const acts = (light: { readonly darkens: boolean }) =>
    light.darkens || shown.some((m) => m.values.lit);
  const under = lightsBelowOf(b);
  const addedBelow = new Map(addedBelowOf(b).map((l) => [l.id, l] as const));
  const lights = [
    ...lightsOfBody(b).map((e) => ({
      light: e.light,
      reach: e.reach,
      reachBelow: e.removable
        ? undefined
        : (under[e.light.id]?.reach ?? addedBelow.get(e.light.id as `added-${string}`)?.reach),
      enabledBelow: e.enabledBelow,
      owner: undefined,
      overlay: e.overlay,
      from: undefined,
      removable: e.removable,
    })),
    ...outer.map(({ light, owner, overlay, from }) => {
      const set = b.settings.lights?.[light.id];
      return {
        light: addedLight(light, set),
        reach: set?.reach ?? light.reach,
        reachBelow: light.reach,
        enabledBelow: true,
        owner,
        overlay,
        from,
        removable: false,
      };
    }),
  ];
  // (A body's list keeps the lights added to it here, acting or not: they can be taken out there.)
  return lights
    .filter(
      ({ light, removable }) =>
        (acts(light) || (receiver === null && removable)) && (receiver === null || light.enabled),
    )
    .map(({ light, ...l }) => ({
      id: light.id,
      kind: light.kind,
      name: light.name,
      darkens: !!light.darkens,
      reaches: receiver === null ? light.enabled : reachesReceiver(l.reach, receiver, parts),
      enabledBelow: l.enabledBelow,
      ...(l.reach ? { reach: l.reach } : {}),
      ...(l.reachBelow ? { reachBelow: l.reachBelow } : {}),
      ...(l.owner !== undefined ? { owner: l.owner } : {}),
      ...(l.overlay ? { overlay: l.overlay } : {}),
      ...(l.from ? { from: l.from } : {}),
      ...(l.removable ? { removable: true } : {}),
    }));
}

/**
 * A body's settings at the level edited with a light taken in or left out by what is selected: a
 * body, switched on or off for it; a part or material, in or out of what it reaches (the reach
 * set here, unless it comes to what is under this level; a light added here, its own).
 */
export function withLitBy(
  s: BodySettings,
  b: BodyInfo,
  light: LitByEntry,
  receiver: Receiver | null,
  on: boolean,
): BodySettings | undefined {
  const id = light.id;
  if (receiver === null) return withLightSwitched(s, id, on, light.enabledBelow);
  const reach = withReceiver(light.reach, receiver, on, partMaterialsOf(b));
  if (s.added?.some((l) => l.id === id))
    return {
      ...s,
      added: s.added.map((l) =>
        l.id !== id ? l : reach ? { ...l, reach } : (without(l, ['reach']) ?? l),
      ),
    };
  if (sameReach(reach, light.reachBelow)) return withoutLightSetting(s, id, ['reach']);
  // Reaching everything over a reach under it: said so.
  return withLightSetting(s, id, { reach: reach ?? { mode: 'except', receivers: [] } });
}

const sameReach = (a: LightReach | undefined, b: LightReach | undefined) => {
  const key = (r: LightReach | undefined) =>
    r && (r.mode === 'only' || r.receivers.length)
      ? `${r.mode}:${[...r.receivers].sort().join(',')}`
      : 'all';
  return key(a) === key(b);
};

/**
 * The view a body's lights are placed from, as the renderer lights it (see `wayOut`): the scene's
 * own camera (`layout`) for a body fixed in the world, its lights fixed there too; the camera the
 * editor looks through (`view`) for one facing the camera, its lights kept to the eye.
 */
export const lightsView = (
  b: BodyInfo | null | undefined,
  layout: Viewpoint,
  view: Viewpoint,
): Viewpoint => (b && valuesOf(b).orientation === 'world' ? layout : view);

/**
 * A shield's lights as lights to mark (their rows' keys under its material's, `base`): each as it
 * is set, white.
 */
export function shieldLightsOf(
  base: string,
  lights: readonly AddedLight[],
): { readonly key: string; readonly light: LightEntry['light'] }[] {
  return lights.map((l) => ({
    key: viewKey(base, { kind: 'gridLight', id: l.id }),
    light: addedLight(l),
  }));
}

/** The shield among a part's materials: the grid, drawn with the shield shader (none: no shield). */
export const shieldOf = (materials: readonly MaterialEntry[]) =>
  materials.find((m) => m.controls.colours);

/**
 * A body's shields' lights as lights to mark, with the body's own: each part's shield's (its own
 * parts' first, then each overlay's it wears), their rows' keys as the tree keys them (`keyOf`:
 * a material's row by its name and, an overlay's, the overlay; a material drawn on several parts
 * under each part).
 */
export function shieldLightsOfBody(
  b: BodyInfo,
  materials: readonly MaterialEntry[],
  keyOf: (name: string, overlay?: string) => string,
): { readonly key: string; readonly light: LightEntry['light'] }[] {
  const nodes = partNodes(b, materials);
  const lightsOf = (list: readonly PartNode[], overlay?: string) => {
    const shared = sharedMaterials(list);
    return list.flatMap(({ part, materials }) => {
      const grid = shieldOf(materials);
      return grid
        ? shieldLightsOf(
            onPart(keyOf(grid.name, overlay), shared.has(grid.name) ? part.key : undefined),
            grid.values.gridLights,
          )
        : [];
    });
  };
  return [
    ...lightsOf(nodes.own),
    ...nodes.overlays.flatMap((o) => lightsOf(o.nodes, o.overlay.id)),
  ];
}

/**
 * A body's lights as its Lights list them: each with a way to it in the tree (its row's key, by
 * `rowKey`), marked with the overlay it is of where it is one's, and taken out where it was added
 * at the level edited.
 */
export function lightItems(b: BodyInfo, rowKey: (id: LightId) => string): AddedItem[] {
  const names = new Map(b.overlays.map((o) => [o.id, overlayLabel(o)] as const));
  const here = new Set<string>((b.settings.added ?? []).map((l) => l.id));
  return lightsOfBody(b).map(({ light, overlay }) => ({
    key: rowKey(light.id),
    label: light.name,
    icon: lightIcon(light),
    ...(overlay ? { detail: names.get(overlay) ?? overlay } : {}),
    removable: here.has(light.id),
  }));
}
