import { type CreatedShape, PART_SHAPES } from '@myrddraall/heroes-replay-stats-aether/overlays';
import {
  type BodyPath,
  changeSettings,
  storedBodies,
  without,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { partId, type PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import type { AddedItem, AddedLists } from '../controls/added-list';
import { bodyLabel, wornKeyOf } from '../bodies/body';
import { lightIcon, sceneLightsOf } from '../lights/lights';
import { type PartEntry, partIcon, partsOfBody } from '../parts/parts';
import { type PartHost } from '../parts/part-hosts';
import type { PickChoice } from '../controls/pick-list';
import {
  bodyKey,
  cameraKey,
  partRowKey,
  placementKey,
  sceneLightKey,
  skyPartKey,
} from './scene-targets';
import type { WithSelection } from './scene-editor.store';

/** The parts added onto the scene's bodies and its sky, as the panels add, reuse and save them. */
export function partHostViews(store: WithSelection) {
  const d = store._draft;
  /** The parts added onto a body of the scene (its settings', in the scene), to change them by. */
  const bodyHost = (path: BodyPath): PartHost | null => {
    const b = store.bodyByKey().get(bodyKey(path));
    if (!b) return null;
    return {
      kind: 'planet',
      parts: b.settings.addedParts ?? [],
      taken: (b.file?.parts ?? []).map(partId),
      set: (parts) =>
        d.setSceneBodies(
          store.scene(),
          storedBodies(
            changeSettings(store.sceneBodies(), path, wornKeyOf(b), (s) =>
              without({ ...s, addedParts: parts }, parts.length ? [] : ['addedParts']),
            ),
            d.library(),
          ),
        ),
    };
  };
  /** The parts added onto the scene's sky, to change them by. */
  const skyHost = (): PartHost => ({
    kind: 'sky',
    parts: store.sceneSky().addedParts ?? [],
    taken: store
      .skyParts()
      .filter((p) => !p.overlay)
      .map((p) => p.key.slice(4)),
    set: (parts) => d.setSkyAddedParts(store.scene(), parts),
  });
  /** Where parts are added for what is selected: the body selected, or the sky. */
  const addHost = computed((): PartHost | null => {
    const t = store.target();
    return t.kind === 'body' ? bodyHost(t.path) : t.kind === 'sky' ? skyHost() : null;
  });
  /** The part selected and where it is kept, where it was added in the scene. */
  const partHost = computed((): { host: PartHost; id: string } | null => {
    const t = store.target();
    if ((t.kind !== 'part' && t.kind !== 'sky-part') || !t.key.startsWith('own:')) return null;
    const host = t.kind === 'part' ? bodyHost(t.path) : skyHost();
    const id = t.key.slice(4);
    return host?.parts.some((p) => p.id === id) ? { host, id } : null;
  });
  return {
    _addHost: addHost,
    _partHost: partHost,
    /**
     * What has been added to what is selected: the scene's planets and the groups put in it, its
     * cameras (its cameras' group's too) and lights; a body's moons and the parts added onto it
     * here; the sky's parts.
     */
    added: computed((): AddedLists => {
      const t = store.target();
      const byKey = store.bodyByKey();
      const body = (path: BodyPath, icon: string): AddedItem[] => {
        const b = byKey.get(bodyKey(path));
        return b
          ? [{ key: bodyKey(path), label: bodyLabel(b), icon, removable: !b.inherited }]
          : [];
      };
      /** The parts added here, as the tree has them (by `own:<id>`). */
      const parts = (
        entries: readonly PartEntry[],
        rowKey: (key: PartKey) => string,
      ): AddedItem[] =>
        (addHost()?.parts ?? []).map((p) => {
          const key = `own:${p.id}` as PartKey;
          const entry = entries.find((e) => e.key === key);
          return {
            key: rowKey(key),
            label: entry?.label ?? p.id,
            icon: entry ? partIcon(entry) : 'circle',
            removable: true,
          };
        });
      const cameras = (): AddedItem[] =>
        store.cameraList().map((c) => ({
          key: cameraKey(c.id),
          label: c.name,
          icon: 'videocam',
          ...(c.id === store.primaryCamera() ? { detail: 'primary' } : {}),
          removable: !c.game,
        }));
      if (t.kind === 'cameras') return { cameras: cameras() };
      if (t.kind === 'scene')
        return {
          planets: [
            ...store.sceneBodies().flatMap((_, i) => body([i], 'public')),
            ...store.placements().map((p, i) => ({
              key: placementKey(i),
              label: store.placementLabel()(p),
              icon: 'workspaces',
              detail: 'group',
              removable: true,
            })),
          ],
          cameras: cameras(),
          lights: sceneLightsOf(store.sceneLights()).map(({ light }) => ({
            key: sceneLightKey(light.id),
            label: light.name,
            icon: lightIcon(light),
            removable: true,
          })),
        };
      if (t.kind === 'body') {
        const b = byKey.get(bodyKey(t.path));
        if (!b) return {};
        return {
          moons: b.moons.flatMap((_, i) => body([...t.path, i], 'brightness_1')),
          parts: parts(partsOfBody(b), (key) => partRowKey(t.path, key)),
        };
      }
      if (t.kind === 'sky') return { parts: parts(store.skyParts(), skyPartKey) };
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
    canSaveAsOverlay: computed(() => (addHost()?.parts.length ?? 0) > 0),
    partMaterials: computed(() => {
      const at = partHost();
      const part = at?.host.parts.find((p) => p.id === at.id);
      return part ? { picked: part.materials, choices: store._catalog.materialChoices() } : null;
    }),
  };
}
