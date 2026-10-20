/**
 * What the Background page has open in its editor, as its URL says
 * (`/edit-background/<kind>/<id>`): a scene (the random sets' when nothing is open), or one of
 * the library's assets; a material opened from a planet or an overlay that uses it, under that
 * one (`/edit-background/<kind>/<id>/material/<material>`). Styles are overlays in the URL.
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

/** The page's URL for what is open (the random sets' scene: the page itself). */
export function openPath(target: OpenTarget): string[] {
  if (target.kind === 'scene' && !target.id) return ['/edit-background'];
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
