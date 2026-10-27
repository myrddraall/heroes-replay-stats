import {
  type CreatedOverlay,
  type CreatedShape,
  PART_SHAPES,
} from '@myrddraall/heroes-replay-stats-aether/overlays';
import { PREVIEW_SCENE } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { partId, type PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import { bodyLabel } from '../bodies/body';
import { type PartEntry, partIcon, partsOfBody } from '../parts/parts';
import { overlayParts, type PartHost, withOverlayParts } from '../parts/part-hosts';
import type { PickChoice } from '../controls/pick-list';
import type { AddedLists } from '../controls/added-list';
import { ASSET, STAGE_SKY, assetPartKey } from './asset-targets';
import type { WithBackground } from './asset-editor.store';

/** The parts added onto the asset open (an overlay made here, a planet's own, the sky's), as the panels add, reuse and save them. */
export function assetPartHostViews(store: WithBackground) {
  const d = store._draft;
  const asset = store.asset;
  /** The overlay open's parts (one made in the editor), to change them by. */
  const overlayHost = (o: CreatedOverlay): PartHost => ({
    kind: o.kind,
    parts: overlayParts(o),
    taken: [],
    set: (parts) => d.changeOverlay(asset().id, (x) => withOverlayParts(x, parts)),
  });
  /** The parts added onto the planet open (in the library), to change them by. */
  const planetHost = (): PartHost | null => {
    const a = asset();
    if (a.kind !== 'planet') return null;
    return {
      kind: 'planet',
      parts: d.library().planets[a.id]?.addedParts ?? [],
      taken: (store._catalog.files()[a.id]?.parts ?? []).map(partId),
      set: (parts) =>
        parts.length
          ? d.setLibraryBody('planets', a.id, { addedParts: parts })
          : d.clearLibraryBody('planets', a.id, ['addedParts']),
    };
  };
  /** The parts added onto a sky (the stage's, or the library's), to change them by. */
  const skyHost = (stage: boolean): PartHost => ({
    kind: 'sky',
    parts: (stage ? store._stageScene().sky : d.library().sky)?.addedParts ?? [],
    taken: store
      ._skyParts(stage)
      .filter((p) => !p.overlay)
      .map((p) => p.key.slice(4)),
    set: (parts) => d.setSkyAddedParts(stage ? PREVIEW_SCENE : null, parts),
  });
  /** Where parts are added for what is selected: the overlay or planet open, or a sky. */
  const addHost = computed((): PartHost | null => {
    const t = store.target();
    const o = store._created();
    if (t.kind === 'body') return o ? overlayHost(o) : planetHost();
    return t.kind === 'sky' ? skyHost(t.stage) : null;
  });
  /** The part selected and where it is kept, where it was made at the level edited. */
  const partHost = computed((): { host: PartHost; id: string } | null => {
    const t = store.target();
    const o = store._created();
    if (t.kind === 'part' && o && t.key.startsWith(`style:${asset().id}:`))
      return { host: overlayHost(o), id: t.key.slice(`style:${asset().id}:`.length) };
    if ((t.kind !== 'part' && t.kind !== 'sky-part') || !t.key.startsWith('own:')) return null;
    const host = t.kind === 'part' ? planetHost() : skyHost(t.stage);
    const id = t.key.slice(4);
    return host?.parts.some((p) => p.id === id) ? { host, id } : null;
  });
  return {
    _addHost: addHost,
    _partHost: partHost,
    /** What has been added to what is selected: the parts made here, on the body or sky open. */
    added: computed((): AddedLists => {
      const t = store.target();
      const host = addHost();
      if (!host?.parts.length && t.kind !== 'body') return {};
      const o = store._created();
      const listed = (
        entries: readonly PartEntry[],
        keyOf: (id: string) => PartKey,
        rowKey: (key: PartKey) => string,
      ): AddedLists => ({
        parts: (host?.parts ?? []).map((p) => {
          const key = keyOf(p.id);
          const entry = entries.find((e) => e.key === key);
          return {
            key: rowKey(key),
            label: entry?.label ?? p.id,
            icon: entry ? partIcon(entry) : 'circle',
            removable: true,
          };
        }),
      });
      if (t.kind === 'body') {
        const b = store._body();
        const infos = store._moonInfos();
        return {
          ...listed(
            b ? partsOfBody(b) : [],
            (id) => (o ? `style:${asset().id}:${id}` : `own:${id}`) as PartKey,
            assetPartKey,
          ),
          // Its own moons, each taken out here where it was put.
          ...(infos.size
            ? {
                moons: [...infos.values()].map((m) => ({
                  key: m.key,
                  label: bodyLabel(m),
                  icon: 'brightness_1',
                  removable: true,
                })),
              }
            : {}),
        };
      }
      if (t.kind === 'sky')
        return listed(
          store._skyParts(t.stage),
          (id) => `own:${id}` as PartKey,
          (key) => `${t.stage ? STAGE_SKY : `${ASSET}/sky`}/p/${key}`,
        );
      return {};
    }),
    partShapes: computed((): readonly CreatedShape[] => {
      const host = addHost();
      return host ? PART_SHAPES[host.kind] : [];
    }),
    reusableParts: computed((): readonly PickChoice[] => {
      const host = addHost();
      if (!host) return [];
      const offered = store._catalog.reusableParts()[host.kind];
      return offered.map((r, i) => ({ value: String(i), label: r.label }));
    }),
    // An overlay is saved from what is added onto a planet or a sky (not from an overlay).
    canSaveAsOverlay: computed(() => !store._created() && (addHost()?.parts.length ?? 0) > 0),
  };
}
