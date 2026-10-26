import type { BodySettings, PlanetChoices } from '../document/scene-settings';

/**
 * Variants: a body's own variations of itself (not shared, as overlays are), each a set of changes
 * to its settings, named, switched on or off. Those on stack in the order of its list, over its own
 * settings and under a scene's. A variant may switch an overlay the body wears on or off
 * (`overlaysEnabled`), never put one on: what a body can wear is its own list.
 *
 * A planet's variants are its data's (the export's, in the planet index) and the library's: those
 * made in the editor, and the library's changes to the data's (by id). Which are on is a setting
 * like any other (`variantsOn`): the library's for the planet, a scene's for it there; and a
 * scene's own variants switch its planets' variants (`SceneVariant`).
 */

/** A variant as kept: its id, name, and the changes it makes (a data variant's, changed: only the changes). */
export interface BodyVariant {
  readonly id: string;
  readonly name?: string;
  readonly settings?: BodySettings;
}

/** What the ids of variants made in the editor start with. */
export const MADE_VARIANT = 'variant-';

/**
 * What of a body's settings is its own alone, never a variant's: what names it, whether it is
 * drawn, what it can wear (a variant switches those on or off, never puts one on), parts added
 * onto it, its variants and which are on.
 */
const BODY_ONLY: readonly (keyof BodySettings)[] = [
  'label',
  'enabled',
  'overlayEnabled',
  'overlays',
  'addedParts',
  'variants',
  'variantsOn',
];

/**
 * A body's settings split for making a variant of them: what a variant can take (`variant`:
 * everything else), and what stays the body's own (`kept`; none: none).
 */
export function variantSettingsOf(settings: BodySettings): {
  readonly variant: BodySettings;
  readonly kept: BodySettings | undefined;
} {
  const entries = Object.entries(settings);
  const only = (k: string) => BODY_ONLY.includes(k as keyof BodySettings);
  const kept = Object.fromEntries(entries.filter(([k]) => only(k)));
  return {
    variant: Object.fromEntries(entries.filter(([k]) => !only(k))),
    kept: Object.keys(kept).length ? kept : undefined,
  };
}

/**
 * A body's variant as it is drawn: its id, its name, whether it was made in the editor, and its
 * settings' layers (the data's, then the library's changes to it).
 */
export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly made: boolean;
  readonly layers: readonly BodySettings[];
}

/** A body's variants in order: its data's (each with the library's changes to it), then those made in the editor. */
export function variantsOf(
  data: readonly BodyVariant[] | undefined,
  own: BodySettings | undefined,
): Variant[] {
  const kept = new Map((own?.variants ?? []).map((v) => [v.id, v] as const));
  const fromData = (data ?? []).map((v): Variant => {
    const changed = kept.get(v.id);
    return {
      id: v.id,
      name: changed?.name ?? v.name ?? v.id,
      made: false,
      layers: [v.settings, changed?.settings].filter((s): s is BodySettings => !!s),
    };
  });
  const dataIds = new Set(fromData.map((v) => v.id));
  const made = (own?.variants ?? [])
    .filter((v) => !dataIds.has(v.id))
    .map((v): Variant => ({
      id: v.id,
      name: v.name ?? v.id,
      made: true,
      layers: v.settings ? [v.settings] : [],
    }));
  return [...fromData, ...made];
}

/** Which of a body's variants are on, as the nearest level that says (`levels`: the nearest first); none: none. */
export const variantsOnOf = (...levels: readonly (BodySettings | undefined)[]): readonly string[] =>
  levels.find((l) => l?.variantsOn !== undefined)?.variantsOn ?? [];

/** The layers a body's variants that are on add, in its list's order. */
export const variantLayersOf = (
  variants: readonly Variant[],
  on: readonly string[],
): BodySettings[] => variants.filter((v) => on.includes(v.id)).flatMap((v) => v.layers);

/** Which variants are on after switches (each variant's id: on or off; one not named stays as it was). */
export function switched(
  on: readonly string[],
  switches: Readonly<Record<string, boolean>> | undefined,
): readonly string[] {
  if (!switches) return on;
  const out = on.filter((id) => switches[id] !== false);
  for (const [id, turnOn] of Object.entries(switches))
    if (turnOn && !out.includes(id)) out.push(id);
  return out;
}

/**
 * A scene's variant: a name, and the variants of its planets it switches on or off (by the body's
 * path in the scene, `pathKey`; then by each variant's id). It sets nothing of a planet itself:
 * a planet's look is always its own.
 */
export interface SceneVariant {
  readonly id: string;
  readonly name: string;
  readonly switches?: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
}

/**
 * Which variants of one of a scene's bodies are on (by its path, `body`): as it has them (`on`),
 * switched by each of the scene's variants that is on, in the scene's order (the later over the
 * earlier).
 */
export function sceneSwitched(
  scene: PlanetChoices | undefined,
  body: string,
  on: readonly string[],
): readonly string[] {
  const active = new Set(scene?.sceneVariantsOn ?? []);
  return (scene?.sceneVariants ?? [])
    .filter((v) => active.has(v.id))
    .reduce((now, v) => switched(now, v.switches?.[body]), on);
}
