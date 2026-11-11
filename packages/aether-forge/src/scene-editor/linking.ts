import {
  handedOnId,
  type LightId,
  type LightSettingsMap,
} from '@myrddraall/heroes-replay-stats-aether/lights';
import { pathOf, siblingKey } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { computed } from '@angular/core';
import { bodyLabel } from '../bodies/body';
import { lightsOfBody } from '../lights/lights';
import { bodyLink, type LinkEntry } from '../lights/linking';
import { bodyKey, placementKey } from './scene-targets';
import type { WithSelection } from './scene-editor.store';

/**
 * The light selected as the bodies it lights know it: a body's (one added to it: its own id; its
 * data's: the id it is handed on under, `handedOnId`), and the body's key; a scene's, its id.
 */
export function linkedLight(
  store: WithSelection,
): { readonly id: LightId; readonly from?: string } | null {
  const t = store.target();
  if (t.kind === 'scene-light') return { id: t.id };
  if (t.kind !== 'light') return null;
  const from = bodyKey(t.path);
  const own = store.bodyByKey().get(from);
  if (!own) return null;
  return { id: t.id.startsWith('added-') ? t.id : handedOnId(own.id, t.id), from };
}

/** What the light selected lights, as its Linking lists it. */
export function linkingViews(store: WithSelection) {
  return {
    /**
     * A body's light: its body, then each other it reaches (in the tree's order). A scene's: each
     * of the scene's planets and moons, then each group put in it (all of a group at once).
     */
    linking: computed((): readonly LinkEntry[] | null => {
      const t = store.target();
      const linked = linkedLight(store);
      if (!linked) return null;
      const bodies = [...store.bodyByKey()].filter(([key]) => key.startsWith('body:'));
      const depth = (key: string) => pathOf(key.slice(5)).length - 1;
      if (t.kind === 'light') {
        const own = store.bodyByKey().get(linked.from!);
        if (!own || !lightsOfBody(own).some((l) => l.light.id === t.id)) return null;
        const reached = new Set(
          [...store.flowed()].flatMap(([key, list]) =>
            list.some((f) => f.from === linked.from && f.light.id === linked.id) ? [key] : [],
          ),
        );
        const links = [
          bodyLink(own, t.id, store.outerLightsOf(t.path), {
            key: linked.from!,
            label: bodyLabel(own),
            depth: depth(linked.from!),
            own: true,
          }),
          ...bodies
            .filter(([key]) => reached.has(key))
            .map(([key, b]) =>
              bodyLink(b, linked.id, store.outerLightsOf(pathOf(key.slice(5))), {
                key,
                label: bodyLabel(b),
                depth: depth(key),
                own: false,
              }),
            ),
        ];
        return links.filter((l) => !!l);
      }
      const links = bodies.map(([key, b]) =>
        bodyLink(b, linked.id, store.outerLightsOf(pathOf(key.slice(5))), {
          key,
          label: bodyLabel(b),
          depth: depth(key),
          own: false,
        }),
      );
      return [
        ...links.filter((l) => !!l),
        ...store.placements().map((p, i): LinkEntry => ({
          key: placementKey(siblingKey(p, i)),
          label: store.placementLabel()(p),
          depth: 0,
          own: false,
          lit: p.lights?.[linked.id]?.enabled !== false,
          changed: p.lights?.[linked.id] !== undefined,
          parts: [],
        })),
      ];
    }),
  };
}

/**
 * What a scene sets of the lights on a group's planets with one taken out of all of them, or (on,
 * or taken back) left to the group.
 */
export function groupLightSwitched(
  lights: LightSettingsMap | undefined,
  id: LightId,
  on: boolean,
): LightSettingsMap | undefined {
  const rest = Object.fromEntries(Object.entries(lights ?? {}).filter(([k]) => k !== id));
  const next: LightSettingsMap = on ? rest : { ...rest, [id]: { enabled: false } };
  return Object.keys(next).length ? next : undefined;
}
