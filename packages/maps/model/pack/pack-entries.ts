import type { MapViewModel } from './map-assets';

/** A pack as the global map store holds it: on its way, loaded, or failed. */
export type PackEntry =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly map: MapViewModel }
  | { readonly status: 'error'; readonly error: string };

export type PackEntries = Readonly<Record<string, PackEntry>>;

/** The entries with `mapId` marked as loading; unchanged when it already has an entry. */
export function startLoading(entries: PackEntries, mapId: string): PackEntries {
  return entries[mapId] ? entries : { ...entries, [mapId]: { status: 'loading' } };
}

export function loaded(entries: PackEntries, mapId: string, map: MapViewModel): PackEntries {
  return { ...entries, [mapId]: { status: 'ready', map } };
}

export function failed(entries: PackEntries, mapId: string, error: string): PackEntries {
  return { ...entries, [mapId]: { status: 'error', error } };
}
