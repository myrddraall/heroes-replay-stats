import {
  bodyAt,
  bodyParts,
  type BodyPath,
  fitRadius,
  fitScene,
  type MoonChoices,
  pathOf,
  placeBodies,
  SCENE_CENTRE,
  type SetPlanet,
  skyOverlayOn,
  type Vec3,
  visualExtent,
} from '@myrddraall/heroes-replay-stats-aether/design';
import { type AddedLight } from '@myrddraall/heroes-replay-stats-aether/lights';
import { computed } from '@angular/core';
import { bodyEnabled, type BodyInfo, filesLoaded, wornIds } from '../../editing/model/body';
import { byDepth, skyOverlayLabel } from '../../editing/model/sky';
import { referenceRow } from '../../editing/model/views';
import { lightIcon, moonLightsOf, sceneLightsOf } from '../../editing/model/lights';
import { type MaterialEntry } from '../../editing/model/materials';
import { wornLabel } from '../../editing/model/overlays';
import type { TreeRow } from '../../tree/scene-tree';
import {
  CAMERAS,
  SCENE,
  SCENE_LIGHTS,
  SKY,
  bodyKey,
  cameraKey,
  glowMarginOf,
  groupBodyKey,
  lightRowKey,
  lightsKey,
  materialRowKey,
  overlayKey,
  overlayLightsKey,
  partRowKey,
  placementKey,
  sceneLightKey,
  skyDepthKey,
  skyMaterialKey,
  skyOverlayKey,
  skyOverlayMaterialKey,
  skyPartKey,
} from '../scene-targets';
import type { WithPartHosts } from '../scene-editor.store';
import { bodySubtreeRows, materialRows } from '../../editing/tree/body-rows';

/** The scene's tree: its rows (the scene, its cameras, sky, groups and bodies, each body's parts, lights and overlays), and the bodies placed. */
export function treeViews(store: WithPartHosts) {
  return {
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const rows: TreeRow[] = [];
      const row = (
        key: string,
        label: string,
        icon: string,
        depth: number,
        unsaved = false,
        group = false,
        enabled?: boolean,
      ) =>
        rows.push({
          key,
          label,
          icon,
          depth,
          expandable: true,
          expanded: open.has(key),
          unsaved,
          group,
          enabled,
        });
      /** A material's row, its layers under it (folded unless unfolded). */
      const leaf = (key: string, m: MaterialEntry, depth: number) =>
        rows.push(...materialRows(key, m, depth, open));
      if (store.groupOpen()) row(SCENE, 'Group', 'workspaces', 0, store.sceneUnsaved());
      else row(SCENE, 'Scene', 'landscape', 0, store.sceneUnsaved());
      if (!open.has(SCENE)) return rows;
      // The scene's own lights, where it has any.
      const own = sceneLightsOf(store.sceneLights());
      if (own.length) {
        rows.push({
          key: SCENE_LIGHTS,
          label: 'Lights',
          icon: 'lightbulb',
          depth: 1,
          expandable: true,
          expanded: !open.has(SCENE_LIGHTS),
          group: true,
        });
        if (!open.has(SCENE_LIGHTS))
          for (const { light } of own)
            rows.push({
              key: sceneLightKey(light.id),
              label: light.name,
              icon: lightIcon(light),
              depth: 2,
              expandable: false,
              expanded: false,
              enabled: light.enabled,
            });
      }
      // Its cameras, the game's first (the one it is shown through marked).
      const cameras = store.cameraList();
      if (cameras.length) {
        rows.push({
          key: CAMERAS,
          label: 'Cameras',
          icon: 'videocam',
          depth: 1,
          expandable: true,
          expanded: !open.has(CAMERAS),
          group: true,
        });
        if (!open.has(CAMERAS))
          for (const c of cameras)
            rows.push({
              key: cameraKey(c.id),
              label: c.name,
              ...(c.id === store.primaryCamera() ? { detail: 'primary' } : {}),
              icon: 'videocam',
              depth: 2,
              expandable: false,
              expanded: false,
            });
      }
      // A group has no sky of its own (it is drawn under the scene's it is put in).
      const sky = !store.groupOpen();
      if (sky) row(SKY, 'Sky', 'blur_on', 1, store.skyUnsaved());
      // Its materials by where they are drawn among the scene's objects: behind, among, in front;
      // then each overlay it wears, its parts with their materials under it.
      if (sky && open.has(SKY))
        for (const g of byDepth(store.skyMaterials().filter((m) => !m.overlay && !m.added))) {
          const group = skyDepthKey(g.depth);
          rows.push({
            key: group,
            label: g.label,
            icon: g.icon,
            depth: 2,
            expandable: true,
            expanded: !open.has(group),
            group: true,
          });
          if (!open.has(group)) for (const m of g.materials) leaf(skyMaterialKey(m.name), m, 3);
        }
      // The parts added onto it (its own), each with the materials it draws.
      if (sky && open.has(SKY))
        for (const part of store.skyParts().filter((p) => !p.overlay)) {
          const key = skyPartKey(part.key);
          const materials = store
            .skyMaterials()
            .filter((m) => m.added && part.materials.includes(m.name));
          rows.push({
            key,
            label: part.label,
            icon: part.band ? 'panorama_horizontal' : 'category',
            depth: 2,
            expandable: materials.length > 0,
            expanded: !open.has(key),
            enabled: part.enabled,
          });
          if (!open.has(key)) for (const m of materials) leaf(skyMaterialKey(m.name), m, 3);
        }
      if (sky && open.has(SKY))
        for (const o of store.skyOverlays()) {
          const group = skyOverlayKey(o.id);
          rows.push({
            key: group,
            label: skyOverlayLabel(o),
            detail: 'overlay',
            icon: 'style',
            depth: 2,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: skyOverlayOn(store.sceneSky(), store._draft.library(), o.id),
            movable: store.skyOverlays().length > 1,
          });
          if (open.has(group)) continue;
          for (const part of store.skyParts().filter((p) => p.overlay === o.id)) {
            const key = skyPartKey(part.key);
            const materials = store
              .skyMaterials()
              .filter((m) => m.overlay === o.id && part.materials.includes(m.name));
            rows.push({
              key,
              label: part.label,
              icon: 'panorama_horizontal',
              depth: 3,
              expandable: materials.length > 0,
              expanded: !open.has(key),
              enabled: part.enabled,
            });
            if (!open.has(key))
              for (const m of materials) leaf(skyOverlayMaterialKey(o.id, m.name), m, 4);
          }
        }
      const body = (b: BodyInfo, depth: number) => {
        const path = pathOf(b.key.slice(5));
        row(
          b.key,
          wornLabel(b),
          path.length > 1 ? 'brightness_1' : 'public',
          depth,
          store.unsavedBodies().has(b.key),
          false,
          bodyEnabled(b),
        );
        if (!open.has(b.key)) return;
        rows.push(
          ...bodySubtreeRows(
            b,
            depth,
            open,
            {
              part: (key) => partRowKey(path, key),
              material: (name, overlay) => materialRowKey(path, name, overlay),
              lights: (overlay) => (overlay ? overlayLightsKey(path, overlay) : lightsKey(path)),
              light: (id) => lightRowKey(path, id),
              overlay: (id) => overlayKey(path, id),
            },
            { movableOverlays: true },
          ),
        );
        b.moons.forEach((_, i) => {
          const child = store.bodyByKey().get(bodyKey([...path, i]));
          if (child) body(child, depth + 1);
        });
      };
      store.sceneBodies().forEach((_, i) => {
        const planet = store.bodyByKey().get(bodyKey([i]));
        if (planet) body(planet, 1);
      });
      // The groups put in it, each switched by its checkbox (what is in it is set in the group).
      store.placements().forEach((p, i) =>
        rows.push({
          key: placementKey(i),
          label: store.placementLabel()(p),
          detail: 'group',
          icon: 'workspaces',
          depth: 1,
          expandable: false,
          expanded: false,
          enabled: p.enabled !== false,
        }),
      );
      rows.push(referenceRow());
      return rows;
    }),
    /**
     * The scene's bodies placed for the background: each planet where it is, its moons about it;
     * centred on a moon, that moon in the middle of the view with its own. Null for the random
     * sets (the background draws them), or while what they need is loading.
     */
    _placed: computed((): { planets: SetPlanet[]; picks: string[] } | null => {
      if (!store.hasPlanets()) return null;
      const planets = store.sceneBodies();
      const grouped = store.placedGroups();
      if (!planets.length && !grouped.length) return { planets: [], picks: [] };
      const scene = store._sceneFile.hasValue() ? store._sceneFile.value() : null;
      if (!scene) return null;
      // Its moons are placed, and what is drawn smaller to keep in view fitted, as the game's
      // camera sees them, so the scene's own cameras and the editor's move round the same layout.
      const layoutView = scene.camera;
      const up = Math.tan((layoutView.fovY * Math.PI) / 360);
      const reach = { up, across: up * store._ui.aspect() };
      /** The scene's bodies from its planet down to the one at a path. */
      const sceneChain = (at: BodyPath) =>
        at.map((_, i) => store.bodyByKey().get(bodyKey(at.slice(0, i + 1))));
      // Each root: a planet where it is (the scene's, or a group's put in it), or the moon
      // centred on; its moons; the path its bodies' own paths are under (the scene's); its
      // bodies from it down to each (`chain`); what picking one selects; the lights of the
      // groups it is in.
      interface Root {
        readonly root: { readonly position: Vec3; readonly radius: number };
        readonly moons: readonly MoonChoices[];
        readonly fit: boolean;
        readonly chain: (path: BodyPath) => (BodyInfo | undefined)[];
        readonly pick: (path: BodyPath) => string;
        readonly lights: readonly AddedLight[];
      }
      const focus = store.focusPath();
      const focused = focus.length ? bodyAt(planets, focus) : undefined;
      const roots: Root[] = focused
        ? [
            {
              root: SCENE_CENTRE,
              moons: focused.moons ?? [],
              fit: true,
              chain: (path) => sceneChain([...focus, ...path]),
              pick: (path) => bodyKey([...focus, ...path]),
              lights: [],
            },
          ]
        : [
            ...planets.map((p, i): Root => ({
              root: { position: p.position, radius: p.radius },
              moons: p.moons ?? [],
              // A scene of one planet is kept in view; several are where they are put.
              fit: planets.length === 1 && !grouped.length,
              chain: (path) => sceneChain([i, ...path]),
              pick: (path) => bodyKey([i, ...path]),
              lights: [],
            })),
            // The groups' planets where they are put: picked, the group put in it is selected.
            ...grouped.map((g, j): Root => ({
              root: { position: g.body.position, radius: g.body.radius },
              moons: g.body.moons ?? [],
              fit: false,
              chain: (path) =>
                [[], ...path.map((_, k) => path.slice(0, k + 1))].map((at) =>
                  store.groupInfos().get(groupBodyKey(j, at)),
                ),
              pick: () => placementKey(g.placement[0]!),
              lights: g.lights,
            })),
          ];
      const out: SetPlanet[] = [];
      /** What picking each body put out selects, in the same order. */
      const picks: string[] = [];
      /** What must stay in view of each body put out, in its radii. */
      const extents: number[] = [];
      for (const { root, moons, fit, chain, pick, lights } of roots) {
        // What must stay in view of each body: as far as its parts and its halo reach.
        const extent = (path: BodyPath) => {
          const b = chain(path).at(-1);
          return b
            ? visualExtent(b.file, b.overlays, bodyParts(b), glowMarginOf(b))
            : visualExtent();
        };
        const base = fit
          ? { ...root, radius: fitRadius(root, moons, layoutView, reach, new Map(), extent) }
          : root;
        for (const p of placeBodies(base, moons, layoutView)) {
          const bodies = chain(p.path);
          const b = bodies.at(-1);
          if (!b || !filesLoaded(b)) return null;
          const s = b.settings;
          // Drawn where it and every body it is a moon of are switched on.
          const drawn = bodies.every((x) => (x?.settings.enabled ?? x?.below?.enabled) !== false);
          // The lights of the bodies it is a moon of that reach their moons, and its groups'.
          const inherited = [
            ...bodies.slice(0, -1).flatMap((parent) => (parent ? moonLightsOf(parent) : [])),
            ...lights,
          ];
          extents.push(visualExtent(b.file, b.overlays, bodyParts(b), glowMarginOf(b)));
          picks.push(pick(p.path));
          out.push({
            id: b.id,
            position: p.position,
            radius: p.radius,
            overlays: wornIds(b),
            ...(b.variantsOn ? { variantsOn: b.variantsOn } : {}),
            ...(drawn ? {} : { enabled: false }),
            ...(s.overlayEnabled !== undefined ? { overlayEnabled: s.overlayEnabled } : {}),
            ...(s.overlaysEnabled ? { overlaysEnabled: s.overlaysEnabled } : {}),
            lighting: s.lighting,
            shade: {
              ...(s.shade !== undefined ? { strength: s.shade } : {}),
              ...(s.shadeTowards ? { direction: s.shadeTowards } : {}),
            },
            materials: s.materials,
            parts: s.parts,
            ...(s.addedParts ? { addedParts: s.addedParts } : {}),
            order: s.order,
            lights: s.lights,
            added: inherited.length ? [...(s.added ?? []), ...inherited] : s.added,
            tint: s.tint,
            lightFrom: s.lightFrom,
            rim: s.rim,
            ...(s.orientation ? { orientation: s.orientation } : {}),
            ...(s.axis ? { axis: s.axis } : {}),
            ...(s.turn !== undefined ? { turn: s.turn } : {}),
            ...(s.baseTurn ? { baseTurn: s.baseTurn } : {}),
          });
        }
      }
      // Several planets where they are put: the whole drawn smaller where any would leave the view.
      return {
        planets: roots.length > 1 ? fitScene(out, extents, layoutView, reach) : out,
        picks,
      };
    }),
  };
}
