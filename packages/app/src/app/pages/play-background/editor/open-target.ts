/**
 * The Background page's URLs. Its editor has open what its URL says
 * (`/edit-background/<kind>/<id>`): a scene (the random sets': `scene/random-sets`), or one of the
 * library's assets; a material opened from a planet or an overlay that uses it, under that one
 * (`/edit-background/<kind>/<id>/material/<material>`). Styles are overlays in the URL. Its
 * library lists one kind of thing (`/edit-background/library/<kind>`, the kind plural: `planets`),
 * one of them shown behind it where its URL names it (`/edit-background/library/<kind>/<id>`; none:
 * the random sets); `/edit-background` alone is the library on the kind it listed last.
 */

/** The library's kinds of asset, each a list in the browser. */
export type AssetKind = 'planet' | 'style' | 'material' | 'particle' | 'sky';
/** What may be open: a scene, a group (edited as a scene is), or one of the library's assets. */
export type OpenKind = 'scene' | 'group' | AssetKind;

export interface OpenTarget {
  readonly kind: OpenKind;
  readonly id: string;
}

/** A planet or an overlay (a style) a material was opened from: what it is shown on. */
export interface MaterialContext {
  readonly kind: 'planet' | 'style';
  readonly id: string;
}

export interface AssetTarget extends OpenTarget {
  readonly kind: AssetKind;
  /** A material's: the planet or overlay it was opened from, where it was. */
  readonly on?: MaterialContext;
}

const KINDS: readonly OpenKind[] = [
  'scene',
  'group',
  'planet',
  'style',
  'material',
  'particle',
  'sky',
];

/** The random sets' scene: what is open when nothing is. */
export const RANDOM_SETS: OpenTarget = { kind: 'scene', id: '' };

/** What is open as a key (`<kind>:<id>`), as the lists name their items. */
export const openKey = (target: OpenTarget) => `${target.kind}:${target.id}`;

/** A kind as the URL says it (a style: an overlay). */
const urlKind = (kind: OpenKind) => (kind === 'style' ? 'overlay' : kind);
/** A kind the URL says (an overlay, or a style as it was called: a style). */
const kindOf = (kind: string) => (kind === 'overlay' ? 'style' : kind);

/** The random sets' scene in the editor's URL (its id being none). */
const RANDOM_SETS_URL = 'random-sets';

/** The editor's URL for what is open. */
export function openPath(target: OpenTarget): string[] {
  if (target.kind === 'scene' && !target.id) return ['/edit-background', 'scene', RANDOM_SETS_URL];
  const on = (target as AssetTarget).on;
  return on
    ? ['/edit-background', urlKind(on.kind), on.id, urlKind(target.kind), target.id]
    : ['/edit-background', urlKind(target.kind), target.id];
}

/**
 * What the URL's path says is open (what it can't read: the random sets): a kind and id, and for
 * a material, what it was opened from (`onKind`, `onId`: a planet or an overlay).
 */
export function openOf(
  kind: string | undefined,
  id: string | undefined,
  onKind?: string,
  onId?: string,
): OpenTarget {
  if (kind === undefined || id === undefined) return RANDOM_SETS;
  if (kind === 'scene' && id === RANDOM_SETS_URL) return RANDOM_SETS;
  const target = parseOpen(`${kindOf(kind)}:${id}`);
  const on = onKind !== undefined ? kindOf(onKind) : undefined;
  if (target.kind !== 'material' || onId === undefined || (on !== 'planet' && on !== 'style'))
    return target;
  const material: AssetTarget = { kind: 'material', id: target.id, on: { kind: on, id: onId } };
  return material;
}

/** What a key says is open (what it can't read: the random sets). */
export function parseOpen(key: string | undefined): OpenTarget {
  const colon = key?.indexOf(':') ?? -1;
  if (!key || colon < 0) return RANDOM_SETS;
  const kind = key.slice(0, colon) as OpenKind;
  return KINDS.includes(kind) ? { kind, id: key.slice(colon + 1) } : RANDOM_SETS;
}

/** Whether what is open is one of the library's assets (else a scene or a group: the scene editor's). */
export const isAsset = (target: OpenTarget): target is AssetTarget =>
  target.kind !== 'scene' && target.kind !== 'group';

/** Each kind's list in the library's URL. */
const LIBRARY_URL: Readonly<Record<OpenKind, string>> = {
  scene: 'scenes',
  group: 'groups',
  planet: 'planets',
  style: 'overlays',
  material: 'materials',
  particle: 'particles',
  sky: 'skies',
};

/** The library's URL listing a kind of thing, one of them (by id) shown behind it where given. */
export function libraryPath(kind: OpenKind, id?: string): string[] {
  return ['/edit-background', 'library', LIBRARY_URL[kind], ...(id ? [id] : [])];
}

/** The kind of thing a library URL lists (none: no list the library has). */
export function libraryKindOf(list: string | undefined): OpenKind | undefined {
  return KINDS.find((kind) => LIBRARY_URL[kind] === list);
}

/** What the library shows behind its list: the thing its URL names, of the kind listed (none: the random sets). */
export const libraryShown = (kind: OpenKind, id: string | undefined): OpenTarget =>
  id ? { kind, id } : RANDOM_SETS;
