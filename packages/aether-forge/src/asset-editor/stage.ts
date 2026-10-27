import { overlayFileFor, ownOverlays } from '@myrddraall/heroes-replay-stats-aether/overlays';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import {
  fitRadius,
  PREVIEW_SCENE,
  setWithMoons,
  visualExtent,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import { variantsOnOf } from '@myrddraall/heroes-replay-stats-aether/variants';
import { mergePartSettings } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import { GRID_CELLS } from '../aids/editing-aids.store';
import { STAND_IN_MATERIAL, standInId, standInLightSettings } from '../aids/stand-in';
import { PREVIEW_POSITION, PREVIEW_RADIUS } from './asset-targets';
import type { WithCameras } from './asset-editor.store';

/** The preview stage: the planets it puts up (the asset, or the stand-in wearing it), its tint and backdrop, and what of the asset is unsaved. */
export function stageViews(store: WithCameras) {
  const {
    asset,
    _materialUse,
    _catalog,
    _sceneFile,
    _draft,
    _ui,
    _skyOverlay,
    _aids,
    variantOpen,
    previewPlanet,
    onStandIn,
  } = store;

  return {
    /**
     * The stage: a planet itself; a style worn by the stand-in planet; a material on the
     * stand-in, drawn as on what uses it (or on that, where asked); the sky with no planet.
     */
    stagePlanets: computed((): SetPlanet[] => {
      const a = asset();
      const use = _materialUse();
      const files = _catalog.files();
      const scene = _sceneFile.hasValue() ? _sceneFile.value() : null;
      /** The stage's place, the asset as big as fits the view with its shells and halo. */
      const fitted = (planet?: string, overlays: readonly string[] = []) => {
        const root = { position: PREVIEW_POSITION, radius: PREVIEW_RADIUS };
        if (!scene) return root;
        const up = Math.tan((scene.camera.fovY * Math.PI) / 360);
        const lib = _draft.library();
        const extent = visualExtent(
          planet ? files[planet] : undefined,
          overlays.map((id) => ({ id, file: files[overlayFileFor(lib, id)] })),
          mergePartSettings(
            planet ? lib.planets[planet]?.parts : undefined,
            ...overlays.map((id) => lib.styles[id]?.parts),
          ),
          // (Its own, over what an overlay it wears sets: the later over the earlier.)
          [...overlays.map((id) => lib.styles[id]), planet ? lib.planets[planet] : undefined]
            .map((s) => s?.glowMargin)
            .filter((m) => m !== undefined)
            .at(-1),
        );
        const view = { up, across: up * _ui.aspect() };
        // (The planet open with its own moons about it: all kept in view.)
        const moons = planet === a.id ? (lib.moons?.[planet] ?? []) : [];
        return {
          ...root,
          radius: fitRadius(root, moons, scene.camera, view, new Map(), () => extent),
        };
      };
      if (a.kind === 'sky' || _skyOverlay()) return []; // the sky alone (with its overlay)
      /** The stand-in planet, a material drawn over it from where it is used (`owner`), if any. */
      const standIn = (owner?: string): SetPlanet => {
        const fill = _aids.standIn();
        const id = standInId({
          fill,
          cells: GRID_CELLS[_aids.gridSize()],
          owner,
          material: owner ? a.id : undefined,
        });
        const tint = { colour: _aids.standInColour(), blend: 'multiply' as const, strength: 1 };
        return {
          id,
          ...fitted(owner),
          materials: fill === 'colour' ? { [STAND_IN_MATERIAL]: { tint } } : undefined,
          // Lit by its own lights, as set (a material preview's: evenly, unless asked).
          lights: standInLightSettings(_aids.standInLights()),
        };
      };
      /**
       * A planet wearing its own: what it chooses for itself, else what its data says; the
       * planet open with the variant edited on too (as it is seen while it is edited).
       */
      const own = (id: string): SetPlanet => {
        const overlays =
          _draft.library().planets[id]?.overlays ?? ownOverlays(files[id]?.tuning?.style);
        const edited = id === a.id ? variantOpen() : null;
        const on = variantsOnOf(_draft.library().planets[id]);
        return {
          id,
          overlays,
          ...(edited && !on.includes(edited) ? { variantsOn: [...on, edited] } : {}),
          ...fitted(id, overlays),
        };
      };
      /** The planet on the stage wearing an overlay. */
      const wearing = (overlay: string): SetPlanet => ({
        id: previewPlanet(),
        overlays: [overlay],
        ...fitted(previewPlanet(), [overlay]),
      });
      // A material opened from a planet or overlay: on that (unless asked for the stand-in).
      if (a.kind === 'material' && a.on && !onStandIn())
        return [a.on.kind === 'planet' ? own(a.on.id) : wearing(a.on.id)];
      if (a.kind === 'material') {
        const owner =
          use?.kind === 'planet'
            ? use.id
            : use?.kind === 'style'
              ? overlayFileFor(_draft.library(), use.id)
              : undefined;
        return [standIn(owner)];
      }
      // Its moons about it as the scene places them: from the game's camera, so moving the
      // editor's goes round them.
      if (a.kind === 'planet')
        return scene ? setWithMoons([own(a.id)], _draft.library(), scene.camera) : [own(a.id)];
      // An overlay on the stand-in: what it adds, on a plain body.
      // A planet's overlay on the stand-in: what it adds, on a plain body (one not yet known to
      // be a planet's, nothing until it is: a sky's is the sky's).
      if (a.kind === 'style')
        return _catalog.styles().includes(a.id)
          ? [{ ...standIn(), overlays: [a.id], ...fitted(undefined, [a.id]) }]
          : [];
      if (use?.kind === 'planet') return [{ id: use.id, ...fitted(use.id) }];
      if (use?.kind === 'style') return [wearing(use.id)];
      return [{ id: previewPlanet(), ...fitted(previewPlanet()) }];
    }),
    stageTint: computed(() => _draft.scenes().settings),
    /** Which asset is on the stage (another one flown to; this one edited, faded in place). */
    stageKey: computed(() => {
      const a = asset();
      return `${a.kind}:${a.id}`;
    }),
    /**
     * The stage's backdrop in place of the sky; none (the sky) for what is part of the sky: the
     * sky open, a particle system, a material only the sky uses.
     */
    stageBackdrop: computed(() => {
      const a = asset();
      const ofSky =
        a.kind === 'sky' ||
        a.kind === 'particle' ||
        _skyOverlay() !== null ||
        (a.kind === 'material' &&
          (_catalog
            .materialByName()
            .get(a.id)
            ?.uses.every((u) => u.kind === 'sky') ??
            false));
      return ofSky ? null : _aids.rendererBackdrop();
    }),
    /** Whether the stage differs from what is published. */
    stageUnsaved: computed(() => _draft.unsavedScenes().has(PREVIEW_SCENE)),
    /** Whether the asset open differs from what is published. */
    assetUnsaved: computed(() => {
      const a = asset();
      switch (a.kind) {
        case 'planet':
          return _draft.unsavedLibraryPlanets().has(a.id);
        case 'style':
          return _draft.unsavedLibraryStyles().has(a.id);
        case 'material':
          return _draft.unsavedLibraryMaterials().has(a.id);
        case 'particle':
        case 'sky':
          return _draft.unsavedLibrarySky();
      }
    }),
  };
}
