import type { EditingAid } from '@myrddraall/heroes-replay-stats-aether/aids';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import type { SceneCameraSet } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import { materialAt } from '../materials/materials';
import { type BodyInfo, bodyLabel } from '../bodies/body';
import { splitViewKey } from '../materials/material-views';
import {
  axisAids,
  lightAids,
  poleMarkers,
  lightSettingLines,
} from '../viewport/markers';
import { placedLightMarkers } from '../viewport/light-drag';
import {
  lightsView,
  type LightEntry,
  bodySurfaceOf,
  shieldSurfaceOf,
  lightIcon,
  lightsOfBody,
  shieldLightsOf,
  shieldLightsOfBody,
} from '../lights/lights';
import type { SceneMarker } from '../viewport/scene-markers';
import { standInLights } from '../aids/stand-in';
import {
  ASSET,
  moonKey,
  moonPaths,
  assetLightKey,
  assetMaterialKey,
  assetOverlayMaterialKey,
  standInLightKey,
} from './asset-targets';
import type { WithStage } from './asset-editor.store';
import type { Vec3 } from '@myrddraall/heroes-replay-stats-aether/space';

/** What the background shows of the stage: what orbits are about, the camera it is seen through, the markers over the view, the lights' beams. */
export function assetBackgroundViews(store: WithStage) {
  /** The stage's body (the asset, or the stand-in) and its lights, as the selection shows them. */
  const litBody = computed(
    (): {
      readonly body: SetPlanet;
      /** What the body is as the editor has it, where it is the asset (not the stand-in): how it is lit. */
      readonly info?: BodyInfo;
      readonly lights: readonly { readonly key: string; readonly light: LightEntry['light'] }[];
    } | null => {
      const body = store.stagePlanets()[0];
      const t = store.target();
      if (!body) return null;
      if (t.kind === 'stand-in' || t.kind === 'stand-in-light')
        return {
          body,
          lights: standInLights(store._aids.standInLights()).map(({ light }) => ({
            key: standInLightKey(light.id),
            light,
          })),
        };
      // A shield's shader, or one of its lights, selected: the shield's lights.
      if ('view' in t && (t.view?.kind === 'gridLight' || t.view?.kind === 'shader')) {
        const base = splitViewKey(store.selected())?.base;
        const m =
          t.kind === 'base-material'
            ? store.baseMaterial()
            : t.kind === 'material'
              ? materialAt(store._ownMaterials(), t.key)
              : undefined;
        const info = store._body() ?? undefined;
        return m && base
          ? { body, ...(info ? { info } : {}), lights: shieldLightsOf(base, m.values.gridLights) }
          : null;
      }
      const b = store._body();
      if (!b || t.kind === 'backdrop' || t.kind === 'reference' || t.kind === 'sky') return null;
      // The asset's lights, and its shields' (the stand-in wears an overlay open).
      return {
        body,
        info: b,
        lights: [
          ...lightsOfBody(b).map(({ light }) => ({ key: assetLightKey(light.id), light })),
          ...shieldLightsOfBody(b, store._ownMaterials(), (name, overlay) =>
            overlay ? assetOverlayMaterialKey(overlay, name) : assetMaterialKey(name),
          ),
        ],
      };
    },
  );
  return {
    /** Where the view puts the camera, for the background (none: the game's). */
    /** A drag in the view orbits round the stage's planet, kept where it is in the view. */
    orbitAbout: computed((): Vec3 | null => store.stagePlanets()[0]?.position ?? null),
    viewCamera: computed((): SceneCameraSet | undefined => {
      const c = store.camera();
      return c ? { eye: c.eye, forward: c.forward, fovY: c.fovY } : undefined;
    }),
    /**
     * The lights' markers on the stage: the selected's owner's (the asset's, or the stand-in's),
     * each one from a side out from the body on the side it comes from, each one from all round
     * on its middle.
     */
    markers: computed((): readonly SceneMarker[] => {
      const view = store.camera();
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      const lit = litBody();
      if (!view || !scene || !lit) return [];
      const { body, lights } = lit;
      const out: SceneMarker[] = [];
      // The planet open's own moons (the planet itself not: the editor is where it is, as inside it).
      if (store.asset().kind !== 'sky') {
        const paths = moonPaths(store._moons());
        store.stagePlanets().forEach((p, i) => {
          const path = i > 0 ? paths[i - 1] : undefined;
          if (!path) return;
          const key = moonKey(path);
          const moon = store._moonInfos().get(key);
          out.push({
            id: key,
            key,
            kind: 'body',
            label: moon ? bodyLabel(moon) : key,
            icon: 'brightness_1',
            at: p.position,
            lift: p.radius,
            selected: store.selected() === key,
            off: p.enabled === false,
          });
        });
      }
      // Where the renderer puts them: as the body is lit (fixed in the world, or kept to the eye).
      const from = lightsView(lit.info, scene.camera, view);
      const marker = (key: string, light: LightEntry['light']) => ({
        id: key,
        key,
        kind: 'light' as const,
        label: light.name,
        icon: lightIcon(light),
        selected: store.selected() === key,
        off: !light.enabled,
      });
      const round = lights.filter(
        ({ light }) =>
          light.kind === 'ambient' ||
          light.kind === 'environment' ||
          (light.kind === 'rim' && !light.from),
      );
      round.forEach(({ key, light }, n) =>
        out.push({
          ...marker(key, light),
          at: body.position,
          nudge: n - (round.length - 1) / 2,
          // (An environment light's: where it reads the sky, about the body.)
          softLines: lightSettingLines(light, body, from, view.eye).soft,
        }),
      );
      for (const { key, light } of lights)
        out.push(...placedLightMarkers(marker(key, light), light, body, from, view.eye));
      // The planet open selected: its poles named at its axis's ends.
      if (store.target().kind === 'body' && lit.info && lit.info.file?.kind !== 'style')
        axisAids(lit.info, body, scene.camera, view).forEach((line, n) =>
          out.push(...poleMarkers(line, ASSET, n)),
        );
      return out;
    }),
    /**
     * What the view shows of the light selected on the stage's body: the outline of where it
     * falls, a directional light's beam. Of the planet open selected: its axis.
     */
    beams: computed((): readonly EditingAid[] => {
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      const lit = litBody();
      const t = store.target();
      const view = store.camera();
      if (!scene || !lit || !view) return [];
      if (t.kind === 'body')
        return lit.info && lit.info.file?.kind !== 'style'
          ? axisAids(lit.info, lit.body, scene.camera, view)
          : [];
      const id =
        t.kind === 'light' || t.kind === 'stand-in-light'
          ? t.id
          : 'view' in t && t.view?.kind === 'gridLight'
            ? t.view.id
            : null;
      const light = id && lit.lights.find(({ light }) => light.id === (id as string))?.light;
      // (A shield's light wraps round the grid by its own spread; any other, by its body's surface.)
      const onShield = 'view' in t && t.view?.kind === 'gridLight';
      return light
        ? lightAids(
            light,
            lit.body,
            lightsView(lit.info, scene.camera, view),
            onShield ? shieldSurfaceOf(light) : bodySurfaceOf(lit.info ?? undefined),
          )
        : [];
    }),
  };
}
