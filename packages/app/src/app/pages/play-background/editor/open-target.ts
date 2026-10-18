/**
 * What the Background page has open in its editor, as its URL says
 * (`/edit-background/<kind>/<id>`): a scene (the random sets' when nothing is open), or one of
 * the library's assets.
 */

/** The library's kinds of asset, each a list in the browser. */
export type AssetKind = 'planet' | 'style' | 'material' | 'particle' | 'sky';
export type OpenKind = 'scene' | AssetKind;

export interface OpenTarget {
  readonly kind: OpenKind;
  readonly id: string;
}

export interface AssetTarget extends OpenTarget {
  readonly kind: AssetKind;
}

const KINDS: readonly OpenKind[] = ['scene', 'planet', 'style', 'material', 'particle', 'sky'];

/** The random sets' scene: what is open when nothing is. */
export const RANDOM_SETS: OpenTarget = { kind: 'scene', id: '' };

/** What is open as a key (`<kind>:<id>`), as the lists name their items. */
export const openKey = (target: OpenTarget) => `${target.kind}:${target.id}`;

/** The page's URL for what is open (the random sets' scene: the page itself). */
export const openPath = (target: OpenTarget): string[] =>
  target.kind === 'scene' && !target.id
    ? ['/edit-background']
    : ['/edit-background', target.kind, target.id];

/** What the URL's path says is open (what it can't read: the random sets). */
export const openOf = (kind: string | undefined, id: string | undefined): OpenTarget =>
  kind !== undefined && id !== undefined ? parseOpen(`${kind}:${id}`) : RANDOM_SETS;

/** What a key says is open (what it can't read: the random sets). */
export function parseOpen(key: string | undefined): OpenTarget {
  const colon = key?.indexOf(':') ?? -1;
  if (!key || colon < 0) return RANDOM_SETS;
  const kind = key.slice(0, colon) as OpenKind;
  return KINDS.includes(kind) ? { kind, id: key.slice(colon + 1) } : RANDOM_SETS;
}

export const isAsset = (target: OpenTarget): target is AssetTarget => target.kind !== 'scene';
