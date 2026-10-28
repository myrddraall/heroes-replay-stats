import { skyOverlayOn } from '@myrddraall/heroes-replay-stats-aether/library';
import type { SkyChoices } from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { PartKey } from '@myrddraall/heroes-replay-stats-aether/formats';
import { computed } from '@angular/core';
import { materialAt, type MaterialEntry } from '../materials/materials';
import { bodyLabel, filesLoaded } from '../bodies/body';
import { byDepth, skyOverlayChoices, skyOverlayLabel } from '../sky/sky';
import { referenceRow } from '../aids/reference-row';
import {
  type LightEntry,
  lightIcon,
  lightsOfBody,
  type LitByEntry,
  litByOf,
} from '../lights/lights';
import { type PartEntry } from '../parts/parts';
import type { PickChoice } from '../controls/pick-list';
import type { TreeRow } from '../tree/scene-tree';
import { standInLights } from '../aids/stand-in';
import {
  ASSET,
  ASSET_LIGHTS,
  STAGE,
  STAGE_BACKDROP,
  STAGE_STAND_IN,
  assetDepthKey,
  assetLightKey,
  assetMaterialKey,
  assetOverlayKey,
  assetVariantKey,
  ASSET_MOONS,
  ASSET_OVERLAYS,
  ASSET_SHAPES,
  ASSET_VARIANTS,
  assetOverlayMaterialKey,
  assetPartKey,
  receiverOf,
  skyRowKeys,
  stageDepthKey,
  stageMaterialKey,
  standInLightKey,
} from './asset-targets';
import type { WithPartHosts } from './asset-editor.store';
import { bodySubtreeRows, materialRows } from '../bodies/body-rows';

/** The selected material, part and light as the panels show them, the sky's overlays, and the asset's tree: its rows. */
export function assetTreeViews(store: WithPartHosts) {
  return {
    partMaterials: computed(() => {
      const at = store._partHost();
      const part = at?.host.parts.find((p) => p.id === at.id);
      return part ? { picked: part.materials, choices: store._catalog.materialChoices() } : null;
    }),
    litBy: computed((): readonly LitByEntry[] | null => {
      const b = store._body();
      const receiver = receiverOf(store.target());
      // A sky's overlay is drawn as the sky is: no light lights it.
      if (store._skyOverlay()) return null;
      return b && filesLoaded(b) && receiver !== undefined ? litByOf(b, receiver) : null;
    }),
    light: computed((): LightEntry | undefined => {
      const t = store.target();
      if (t.kind === 'stand-in-light')
        return standInLights(store._aids.standInLights()).find((l) => l.light.id === t.id);
      const b = store._body();
      return t.kind === 'light' && b ? lightsOfBody(b).find((l) => l.light.id === t.id) : undefined;
    }),
    part: computed((): PartEntry | undefined => {
      const t = store.target();
      if (t.kind === 'sky-part') return store._skyParts(t.stage).find((p) => p.key === t.key);
      return t.kind === 'part' ? store._ownParts().find((p) => p.key === t.key) : undefined;
    }),
    material: computed((): MaterialEntry | undefined => {
      const t = store.target();
      if (t.kind === 'base-material') return store.baseMaterial();
      if (t.kind === 'sky-material') return materialAt(store._skyMaterials(t.stage), t.key);
      return t.kind === 'material' ? materialAt(store._ownMaterials(), t.key) : undefined;
    }),
    /** The stage's sky: its own, but for the sky open (shown as the library has it). */
    stageSky: computed((): SkyChoices => {
      if (store.asset().kind === 'sky') return {};
      const sky = store._stageScene().sky ?? {};
      // A sky's overlay open: worn by the stage's sky (over what it wears), drawn.
      const o = store._skyOverlay();
      if (!o) return sky;
      const worn = store._skyOverlays(true).map((x) => x.id);
      return {
        ...sky,
        overlays: worn.includes(o.id) ? worn : [...worn, o.id],
        overlaysEnabled: { ...sky.overlaysEnabled, [o.id]: true },
      };
    }),
    /** The overlays the sky selected wears (the stage's, or the library's), in order. */
    skyWorn: computed((): readonly string[] => {
      const t = store.target();
      const stage =
        t.kind === 'backdrop' || ((t.kind === 'sky' || t.kind === 'sky-material') && t.stage);
      return store._skyOverlays(stage).map((o) => o.id);
    }),
    /** Whether what the sky selected wears is chosen at the level it is edited at. */
    skyOverlaysSet: computed(() => {
      const t = store.target();
      const stage =
        t.kind === 'backdrop' || ((t.kind === 'sky' || t.kind === 'sky-material') && t.stage);
      return (
        (stage ? store._stageScene().sky?.overlays : store._draft.library().sky.overlays) !==
        undefined
      );
    }),
    /** The overlays a sky may wear: the game data's, and those made in the editor; by name. */
    skyOverlayOptions: computed((): readonly PickChoice[] =>
      skyOverlayChoices(
        store._sceneFile.hasValue() ? store._sceneFile.value() : null,
        store._draft.library(),
      ),
    ),
    rows: computed((): TreeRow[] => {
      const open = store.unfolded();
      const a = store.asset();
      const rows: TreeRow[] = [];
      const row = (
        key: string,
        label: string,
        icon: string,
        depth: number,
        unsaved = false,
        group = false,
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
        });
      const leaf = (
        key: string,
        label: string,
        depth: number,
        enabled: boolean,
        unsaved = false,
        detail?: string,
        movable = false,
      ) =>
        rows.push({
          key,
          label,
          detail,
          icon: 'texture',
          depth,
          expandable: false,
          expanded: false,
          enabled,
          unsaved,
          movable,
        });
      /** A material's row (movable: its draw order, unless opaque), its layers under it (folded unless unfolded). */
      const materialRow = (
        key: string,
        m: MaterialEntry,
        depth: number,
        unsaved = false,
        movable = m.values.blend !== 'opaque',
      ) => rows.push(...materialRows(key, m, depth, open, unsaved, movable));
      /**
       * A sky's materials by where they are drawn among the scene's objects: behind, among, in front
       * (each group open unless folded: its key among those kept means folded).
       */
      /**
       * A sky's parts' rows (its own added onto it, or under the overlay they are of), their
       * materials under each (its own's by `ownMaterialKey`).
       */
      const skyPartRows = (
        parts: readonly PartEntry[],
        materials: readonly MaterialEntry[],
        partKey: (key: PartKey) => string,
        materialKey: (overlay: string, name: string) => string,
        depth: number,
        ownMaterialKey?: (name: string) => string,
      ) => {
        for (const part of parts) {
          const key = partKey(part.key);
          const drawn = materials.filter(
            (m) => m.overlay === part.overlay && part.materials.includes(m.name),
          );
          rows.push({
            key,
            label: part.label,
            icon: part.band || part.overlay ? 'panorama_horizontal' : 'category',
            depth,
            expandable: drawn.length > 0,
            expanded: !open.has(key),
            enabled: part.enabled,
          });
          if (!open.has(key))
            for (const m of drawn)
              materialRow(
                part.overlay || !ownMaterialKey
                  ? materialKey(part.overlay ?? '', m.name)
                  : ownMaterialKey(m.name),
                m,
                depth + 1,
              );
        }
      };
      /**
       * A sky's rows (the stage's, or the sky open's): its own materials by depth; then each overlay
       * it wears (open unless folded), its parts and their materials under it.
       */
      const skyRows = (
        stage: boolean,
        groupKey: (depth: string) => string,
        materialKey: (name: string) => string,
        depth: number,
      ) => {
        const materials = store._skyMaterials(stage);
        const keys = skyRowKeys(stage);
        ownSkyRows(
          materials.filter((m) => !m.overlay && !m.added),
          groupKey,
          materialKey,
          depth,
        );
        const sky = stage ? store._stageScene().sky : undefined;
        const overlays = store._skyOverlays(stage);
        const parts = store._skyParts(stage);
        // The parts added onto it (its own), each with the materials it draws.
        skyPartRows(
          parts.filter((p) => !p.overlay),
          materials,
          keys.part,
          keys.material,
          depth,
          materialKey,
        );
        for (const o of overlays) {
          const group = keys.overlay(o.id);
          rows.push({
            key: group,
            label: skyOverlayLabel(o),
            detail: 'overlay',
            icon: 'style',
            depth,
            expandable: true,
            expanded: !open.has(group),
            group: true,
            enabled: skyOverlayOn(sky, store._draft.library(), o.id),
            movable: overlays.length > 1,
          });
          if (!open.has(group))
            skyPartRows(
              parts.filter((p) => p.overlay === o.id),
              materials,
              keys.part,
              keys.material,
              depth + 1,
            );
        }
      };
      const ownSkyRows = (
        materials: readonly MaterialEntry[],
        groupKey: (depth: string) => string,
        materialKey: (name: string) => string,
        depth: number,
      ) => {
        for (const g of byDepth(materials)) {
          const group = groupKey(g.depth);
          rows.push({
            key: group,
            label: g.label,
            icon: g.icon,
            depth,
            expandable: true,
            expanded: !open.has(group),
            group: true,
          });
          if (!open.has(group))
            for (const m of g.materials) materialRow(materialKey(m.name), m, depth + 1);
        }
      };
      const sky = store._skyMaterials(false);
      // A sky's overlay open: its parts about the eye, their materials under each.
      const skyOverlay = store._skyOverlay();
      if (skyOverlay) {
        row(
          ASSET,
          skyOverlayLabel({ ...skyOverlay, below: store._draft.library().styles[skyOverlay.id] }),
          'style',
          0,
          store.assetUnsaved(),
        );
        if (open.has(ASSET))
          skyPartRows(
            store._skyOverlayParts(),
            store._skyOverlayMaterials(),
            assetPartKey,
            (_, name) => assetMaterialKey(name),
            1,
          );
      } else
        switch (a.kind) {
          case 'planet':
          case 'style': {
            const b = store._body();
            row(
              ASSET,
              b ? bodyLabel(b) : a.id,
              a.kind === 'planet' ? 'public' : 'style',
              0,
              store.assetUnsaved(),
            );
            if (!open.has(ASSET) || !b) break;
            rows.push(
              ...bodySubtreeRows(
                b,
                0,
                open,
                {
                  part: assetPartKey,
                  material: (name, overlay) =>
                    overlay ? assetOverlayMaterialKey(overlay, name) : assetMaterialKey(name),
                  light: assetLightKey,
                  overlay: assetOverlayKey,
                  variant: assetVariantKey,
                  shapes: () => ASSET_SHAPES,
                  lights: () => ASSET_LIGHTS,
                  overlays: () => ASSET_OVERLAYS,
                  variants: () => ASSET_VARIANTS,
                  moons: () => ASSET_MOONS,
                },
                {
                  movableOverlays: false,
                  variants: store.variantRows(),
                  adds: {
                    shapes: store.partShapes().length > 0,
                    lights: true,
                    overlays: a.kind === 'planet',
                    variants: store.variantsEditable(),
                    moons: a.kind === 'planet',
                  },
                  variantEdited: store.variantEdited(),
                  // Its own moons (a planet's), each switched by its checkbox.
                  moons: (at) =>
                    a.kind === 'planet'
                      ? [...store._moonInfos()].map(([key, m]) => ({
                          key,
                          label: bodyLabel(m),
                          icon: 'brightness_1',
                          depth: at + (m.key.split('.').length - 1),
                          expandable: false,
                          expanded: false,
                          enabled: m.settings.enabled !== false,
                        }))
                      : [],
                },
              ),
            );
            break;
          }
          case 'material': {
            const m = store.baseMaterial();
            if (m) materialRow(ASSET, m, 0, store.assetUnsaved(), false);
            else leaf(ASSET, a.id, 0, true, store.assetUnsaved(), a.id);
            break;
          }
          case 'particle': {
            const material = store._catalog.particles().find((p) => p.id === a.id)?.material;
            row(ASSET, a.id, 'grain', 0);
            const m = sky.find((s) => s.name === material);
            if (open.has(ASSET) && m) materialRow(assetMaterialKey(m.name), m, 1, false, false);
            break;
          }
          case 'sky':
            row(ASSET, 'Sky', 'blur_on', 0, store.assetUnsaved());
            if (open.has(ASSET)) skyRows(false, assetDepthKey, assetMaterialKey, 1);
            break;
        }
      // The stage, after what is edited and set apart from it: only there to see it (the sky open
      // is its own stage). Its rows are marked as aids.
      const aidsFrom = rows.length;
      if (a.kind !== 'sky') {
        row(STAGE, 'Preview stage', 'videocam', 0, store.stageUnsaved(), true);
        if (open.has(STAGE)) {
          // The backdrop: the stage's sky (its materials under it), or a colour or grid in its place.
          if (store.preview().backdrop === 'sky') {
            row(STAGE_BACKDROP, 'Backdrop', 'wallpaper', 1);
            if (open.has(STAGE_BACKDROP)) skyRows(true, stageDepthKey, stageMaterialKey, 2);
          } else
            rows.push({
              key: STAGE_BACKDROP,
              label: 'Backdrop',
              icon: 'wallpaper',
              depth: 1,
              expandable: false,
              expanded: false,
            });
          // The stand-in only where it is shown: a material or a style opened on its own (a
          // material opened from a planet or overlay: where switched to the stand-in); its
          // lights under it (open unless folded: its key among those kept means folded). A
          // planet's style shown worn by a planet of the library instead: that planet's row,
          // where the stand-in's is (what it is shown on is chosen there).
          if (
            (a.kind === 'material' && !(a.on && !store.onStandIn())) ||
            (a.kind === 'style' && !store._skyOverlay())
          ) {
            const on = a.kind === 'style' ? store.preview().planet : null;
            const unfolded = !on && !open.has(STAGE_STAND_IN);
            rows.push({
              key: STAGE_STAND_IN,
              label: on ?? 'Stand-in planet',
              icon: on ? 'public' : 'circle',
              depth: 1,
              expandable: !on,
              expanded: unfolded,
            });
            if (unfolded)
              for (const { light } of standInLights(store._aids.standInLights()))
                rows.push({
                  key: standInLightKey(light.id),
                  label: light.name,
                  icon: lightIcon(light),
                  depth: 2,
                  expandable: false,
                  expanded: false,
                  enabled: light.enabled,
                });
          }
        }
      }
      rows.push(referenceRow());
      for (let i = aidsFrom; i < rows.length; i++) rows[i] = { ...rows[i]!, aid: true };
      return rows;
    }),
  };
}
