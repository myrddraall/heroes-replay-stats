import type { EditingAid } from '@myrddraall/heroes-replay-stats-aether/aids';
import { distanceAhead } from '@myrddraall/heroes-replay-stats-aether/camera';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import { pathOf, SCENE_CENTRE, siblingKey } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { computed } from '@angular/core';
import type { SceneMarker } from '../viewport/scene-markers';
import { type BodyInfo, bodyLabel } from '../bodies/body';
import { splitViewKey } from '../materials/material-views';
import { axisAids, lightAids, poleMarkers, lightMarkerAt, spotEdges } from '../viewport/markers';
import {
  lightsView,
  type LightEntry,
  lightIcon,
  lightsOfBody,
  sceneLightsOf,
  shieldLightsOf,
  shieldLightsOfBody,
} from '../lights/lights';
import { materialAt, materialsOf } from '../materials/materials';
import {
  bodyKey,
  cameraKey,
  lightRowKey,
  materialRowKey,
  placementKey,
  sceneLightKey,
} from './scene-targets';
import type { WithTree } from './scene-editor.store';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';

/** What the background shows of the scene: its planets placed, what orbits are about, the markers over the view, the lights' beams. */
export function backgroundViews(store: WithTree) {
  return {
    /** The scene's bodies placed for the background (null: the random sets', or loading). */
    scenePlanets: computed(() => {
      const placed = store._placed();
      const inside = store.insideTarget();
      if (!placed || !inside) return placed?.planets ?? null;
      // Inside a planet, a moon or an overlay one wears: all but it and its moons dimmed.
      const at = bodyKey(inside.path);
      return placed.planets.map((p, i) => {
        const pick = placed.picks[i] ?? '';
        return pick === at || pick.startsWith(`${at}.`) ? p : { ...p, dimmed: true };
      });
    }),
    /** A drag in the view orbits round what it looks at (the scene's middle as far ahead). */
    orbitAbout: computed((): Vec3 | null => null),
    /**
     * What the view marks where it is: the scene's cameras (not the one looked through), each
     * with what it sees outlined; the groups put in it; the lights of what is selected (a body's
     * round it, the scene's round each of its planets), each on the side it comes from.
     */
    markers: computed((): readonly SceneMarker[] => {
      const view = store.camera();
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!view || !scene) return [];
      const t = store.target();
      const out: SceneMarker[] = [];
      for (const c of store.cameraList()) {
        if (c.id === store.look()) continue;
        const camera = { ...scene.camera, ...c.set };
        out.push({
          id: cameraKey(c.id),
          key: cameraKey(c.id),
          kind: 'camera',
          label: c.name,
          icon: 'videocam',
          at: camera.eye,
          camera,
          // What it sees outlined as far as the scene's middle.
          outline: distanceAhead(camera, SCENE_CENTRE.position, 5),
          selected: t.kind === 'camera' && t.id === c.id,
        });
      }
      store.placements().forEach((p, i) =>
        out.push({
          id: placementKey(siblingKey(p, i)),
          key: placementKey(siblingKey(p, i)),
          kind: 'group',
          label: store.placementLabel()(p),
          icon: 'workspaces',
          at: p.position,
          selected: t.kind === 'placement' && t.key === siblingKey(p, i),
          off: p.enabled === false,
        }),
      );
      const placed = store._placed();
      if (!placed) return out;
      // Each planet and moon (not a group's: the group's marker is its), but those dimmed outside
      // what the editor is inside.
      const inside = store.insideTarget();
      const at = inside && bodyKey(inside.path);
      placed.picks.forEach((pick, i) => {
        const body = placed.planets[i];
        const b = store.bodyByKey().get(pick);
        if (!body || !b || !pick.startsWith('body:')) return;
        // (The one it is inside is where the editor is: not marked; its moons are.)
        if (at && !pick.startsWith(`${at}.`)) return;
        out.push({
          id: pick,
          key: pick,
          kind: 'body',
          label: bodyLabel(b),
          icon: pathOf(pick.slice(5)).length > 1 ? 'brightness_1' : 'public',
          at: body.position,
          lift: body.radius,
          selected: t.kind === 'body' && bodyKey(t.path) === pick,
          off: body.enabled === false,
        });
      });
      /**
       * A body's lights' markers: each one from a side out from the body, on the side it comes
       * from (in the body's frame), a line to it; each one from all round on the body's middle
       * (several there side by side).
       */
      const lit = (
        lights: readonly { readonly key: string; readonly light: LightEntry['light'] }[],
        body: SetPlanet,
        i: number,
        b: BodyInfo | undefined,
      ) => {
        // Where the renderer puts them: as the body is lit (fixed in the world, or kept to the eye).
        const from = lightsView(b, scene.camera, view);
        const round = lights.filter(
          ({ light }) =>
            light.kind === 'ambient' ||
            light.kind === 'environment' ||
            (light.kind === 'rim' && !light.from),
        );
        const marker = (key: string, light: LightEntry['light'], at: Vec3) => ({
          id: `${key}@${i}`,
          key,
          kind: 'light' as const,
          label: light.name,
          icon: lightIcon(light),
          at,
          selected: store.selected() === key,
          off: !light.enabled,
        });
        round.forEach(({ key, light }, n) =>
          out.push({ ...marker(key, light, body.position), nudge: n - (round.length - 1) / 2 }),
        );
        for (const { key, light } of lights) {
          const at = lightMarkerAt(light, body, from);
          if (at)
            out.push({
              ...marker(key, light, at.at),
              from: at.from,
              lines: spotEdges(light, body, from, view.eye),
            });
        }
      };
      if (t.kind === 'scene-light') {
        placed.picks.forEach((pick, i) => {
          const body = placed.planets[i];
          if (!body || !pick.startsWith('body:') || pathOf(pick.slice(5)).length !== 1) return;
          lit(
            sceneLightsOf(store.sceneLights()).map(({ light }) => ({
              key: sceneLightKey(light.id),
              light,
            })),
            body,
            i,
            store.bodyByKey().get(pick),
          );
        });
      } else if (
        t.kind === 'material' &&
        (t.view?.kind === 'gridLight' || t.view?.kind === 'shader')
      ) {
        // A shield's light, or its shader, selected: the shield's lights, round its body.
        const split = splitViewKey(store.selected());
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const i = placed.picks.indexOf(key);
        const body = placed.planets[i];
        const m = b && materialAt(materialsOf(b), t.key);
        if (m && body && split) lit(shieldLightsOf(split.base, m.values.gridLights), body, i, b);
      } else {
        // Inside a planet or moon: its lights (inside an overlay it wears, the overlay's), whatever
        // is selected in it. Outside: only a light selected (in the tree), on its body.
        const path = inside?.path ?? ('path' in t && t.path.length ? t.path : null);
        const key = path && bodyKey(path);
        const b = key ? store.bodyByKey().get(key) : undefined;
        const i = key ? placed.picks.indexOf(key) : -1;
        const body = placed.planets[i];
        if (path && b && body) {
          const all = [
            ...lightsOfBody(b)
              .filter(({ overlay }) => inside?.kind !== 'overlay' || overlay === inside.id)
              .map(({ light }) => ({ key: lightRowKey(path, light.id), light })),
            ...(inside?.kind === 'overlay'
              ? []
              : shieldLightsOfBody(b, materialsOf(b), (name, overlay) =>
                  materialRowKey(path, name, overlay),
                )),
          ];
          const lights = inside ? all : all.filter((l) => l.key === store.selected());
          if (lights.length) lit(lights, body, i, b);
        }
        // A planet or moon selected: its poles named at its axis's ends.
        if (t.kind === 'body') {
          const selected = bodyKey(t.path);
          const sb = store.bodyByKey().get(selected);
          const sbody = placed.planets[placed.picks.indexOf(selected)];
          if (sb && sbody)
            axisAids(sb, sbody, scene.camera, view).forEach((line, n) =>
              out.push(...poleMarkers(line, selected, n)),
            );
        }
      }
      return out;
    }),
    /**
     * What the view shows of the light selected, on each body it lights (the scene's: each of
     * its planets): the outline of where it falls, a directional light's beam. Of a body
     * selected: its axis.
     */
    beams: computed((): readonly EditingAid[] => {
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      const placed = store._placed();
      const t = store.target();
      if (!scene || !placed) return [];
      const view = store.camera();
      if (!view) return [];
      if (t.kind === 'body') {
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const body = placed.planets[placed.picks.indexOf(key)];
        return b && body ? axisAids(b, body, scene.camera, view) : [];
      }
      // Placed as each body is lit (fixed in the world, or kept to the eye: see `lightsView`).
      const beam = (
        light: LightEntry['light'],
        body: SetPlanet,
        b: BodyInfo | undefined,
      ): EditingAid[] => lightAids(light, body, lightsView(b, scene.camera, view));
      if (t.kind === 'scene-light') {
        const light = sceneLightsOf(store.sceneLights()).find((l) => l.light.id === t.id)?.light;
        if (!light) return [];
        return placed.picks.flatMap((pick, i) => {
          const body = placed.planets[i];
          return body && pick.startsWith('body:') && pathOf(pick.slice(5)).length === 1
            ? beam(light, body, store.bodyByKey().get(pick))
            : [];
        });
      }
      if (t.kind === 'material' && t.view?.kind === 'gridLight') {
        const id = t.view.id;
        const key = bodyKey(t.path);
        const b = store.bodyByKey().get(key);
        const body = placed.planets[placed.picks.indexOf(key)];
        const m = b && materialAt(materialsOf(b), t.key);
        const light =
          m && shieldLightsOf('', m.values.gridLights).find((l) => l.light.id === (id as string));
        return light && body ? beam(light.light, body, b) : [];
      }
      if (t.kind !== 'light') return [];
      const key = bodyKey(t.path);
      const b = store.bodyByKey().get(key);
      const body = placed.planets[placed.picks.indexOf(key)];
      const light = b && lightsOfBody(b).find((l) => l.light.id === t.id)?.light;
      return light && body ? beam(light, body, b) : [];
    }),
  };
}
