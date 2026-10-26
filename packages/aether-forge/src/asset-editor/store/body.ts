import {
  moonAt,
  type MoonChoices,
  overlayFileFor,
  ownOverlays,
  withAddedParts,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { computed } from '@angular/core';
import { type BodyInfo } from '../../editing/model/body';
import { ASSET, libraryKind, moonKey, moonPaths } from '../asset-targets';
import type { WithStageSky } from '../asset-editor.store';

/** The body open (a planet, or an overlay on the stand-in), its levels, and its moons. */
export function assetBodyViews(store: WithStageSky) {
  const { asset, _draft, _catalog, _skyOverlay: skyOverlay, _planetLevels: planetLevels } = store;
  const library = _draft.library;
  /** The planet open's own moons (the library's; none for anything else). */
  const moons = computed((): readonly MoonChoices[] => {
    const a = asset();
    return a.kind === 'planet' ? (library().moons?.[a.id] ?? []) : [];
  });
  return {
    /**
     * The planet or style open, as the editor has it: its defaults over its file's tuning; a
     * planet in the style it wears of its own, whose settings it sets as it wears it.
     */
    _body: computed((): BodyInfo | null => {
      const a = asset();
      const kind = libraryKind(a.kind);
      if (!kind) return null;
      const files = _catalog.files();
      // A sky's overlay open: a body with no parts of its own (its parts are the sky's).
      const file = skyOverlay()
        ? { kind: 'style' as const, parts: [], materials: {}, textures: {} }
        : a.kind === 'planet'
          ? files[a.id] &&
            withAddedParts(files[a.id], library().planets[a.id]?.addedParts, _catalog.madeLookup())
          : files[overlayFileFor(library(), a.id)];
      // A planet wears what it chooses for itself, else what its data says; an overlay, none.
      const chosen = a.kind === 'planet' ? library().planets[a.id]?.overlays : undefined;
      const worn = a.kind === 'planet' ? (chosen ?? ownOverlays(file?.tuning?.style)) : [];
      const name = (id: string) => library().created?.[id]?.label;
      const made = name(a.id) ?? skyOverlay()?.name;
      return {
        key: ASSET,
        id: a.id,
        ...(made ? { name: made } : {}),
        overlays: worn.map((id) => ({
          id,
          ...(name(id) ? { name: name(id) } : {}),
          below: library().styles[id],
          file: files[overlayFileFor(library(), id)],
        })),
        overlaysSet: chosen !== undefined,
        ...(a.kind === 'planet' ? planetLevels(a.id) : { settings: library()[kind][a.id] ?? {} }),
        materialBase: library().materials,
        file,
        moons: [],
      };
    }),
    /** The planet open's own moons (the library's; none for anything else). */
    _moons: moons,
    /** Those moons as the editor has them (theirs after each), by `moonKey`. */
    _moonInfos: computed((): ReadonlyMap<string, BodyInfo> => {
      const files = _catalog.files();
      const lib = library();
      const list = moons();
      const out = new Map<string, BodyInfo>();
      for (const path of moonPaths(list)) {
        const m = moonAt(list, path)!;
        const file = files[m.id];
        const worn = m.overlays ?? lib.planets[m.id]?.overlays ?? ownOverlays(file?.tuning?.style);
        out.set(moonKey(path), {
          key: moonKey(path),
          id: m.id,
          overlays: worn.map((id) => ({
            id,
            ...(lib.created?.[id] ? { name: lib.created[id].label } : {}),
            below: lib.styles[id],
            file: files[overlayFileFor(lib, id)],
          })),
          overlaysSet: m.overlays !== undefined,
          settings: m.settings ?? {},
          below: lib.planets[m.id],
          materialBase: lib.materials,
          file: file && withAddedParts(file, lib.planets[m.id]?.addedParts, _catalog.madeLookup()),
          orbit: m.orbit,
          moons: m.moons ?? [],
        });
      }
      return out;
    }),
  };
}
