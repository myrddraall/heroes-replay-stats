import type { UrlMatcher, UrlMatchResult, UrlSegment } from '@angular/router';

/**
 * The editor's URLs, under `path`: `path` alone (the library), `path/library/<list>` and
 * `path/library/<list>/<id>` (the library listing a kind, and what it shows behind: `library` and
 * `item` for the page), `path/<kind>/<id>` (what is open in its editor: `kind` and `id` for the
 * page), or `path/<kind>/<id>/material/<material>` (a material opened from that planet or
 * overlay: `onKind` and `onId` too). One route for all, so moving between them keeps the page
 * (its draft, its panels, its view) as it is.
 */
export function forgeMatcher(path: string): UrlMatcher {
  return (segments: UrlSegment[]): UrlMatchResult | null => {
    if (segments[0]?.path !== path) return null;
    if (segments.length === 1) return { consumed: segments };
    if (segments[1]!.path === 'library') {
      if (segments.length === 3)
        return { consumed: segments, posParams: { library: segments[2]! } };
      if (segments.length === 4)
        return { consumed: segments, posParams: { library: segments[2]!, item: segments[3]! } };
      return null;
    }
    if (segments.length === 3)
      return { consumed: segments, posParams: { kind: segments[1]!, id: segments[2]! } };
    if (segments.length === 5 && segments[3]!.path === 'material')
      return {
        consumed: segments,
        posParams: {
          onKind: segments[1]!,
          onId: segments[2]!,
          kind: segments[3]!,
          id: segments[4]!,
        },
      };
    return null;
  };
}
