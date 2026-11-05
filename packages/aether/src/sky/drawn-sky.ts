import { stackedTints, type TintLayer, type TintSwitches } from '../tints/tint-layers';
import type { PlayScene, SkyOverlayFile } from '../formats/play-scene';
import type { PartSettingsMap } from '../formats/part-shapes';
import {
  materialKey,
  type MaterialSettingsMap,
  mergeSettings,
} from '../materials/material-settings';
import type { SkyAnchor } from './sky-anchors';
import type { SkySettings } from './sky-settings';

/**
 * The sky as the renderer draws it, worked out from its settings and its scene: the overlays it
 * wears (its own parts first, then those its settings name, else its scene's), each with its file,
 * and each material's settings come to (an overlay's over the sky's base settings for it).
 */
export interface DrawnSky {
  readonly worn: readonly {
    /** The overlay's id ('' for the sky's own parts). */
    readonly id: string;
    readonly file: SkyOverlayFile;
    /** The images its textures are, where it was made in the editor. */
    readonly images?: Readonly<Record<string, ImageBitmap>>;
  }[];
  /** Its materials' settings, by `materialKey`: its own by name, its overlays' by overlay too. */
  readonly materials: MaterialSettingsMap;
  readonly tints?: readonly TintLayer[];
  /** Which of its tints are drawn, by id (see `TintsSet`). */
  readonly tintsEnabled?: TintSwitches;
  /** How it is anchored against the camera, where its materials don't say otherwise. */
  readonly anchor?: SkyAnchor;
  /** Its materials' draw order, by `materialKey`, where set. */
  readonly order?: readonly string[];
  /** Its overlays' parts' settings, by part. */
  readonly parts?: PartSettingsMap;
}

/** A sky's settings as drawn in a scene. */
export function drawnSky(sky: SkySettings, scene: PlayScene): DrawnSky {
  const worn = [
    ...(sky.own ? [{ id: '', ...sky.own }] : []),
    ...(sky.overlays ?? scene.wears ?? []).flatMap((id) => {
      const made = sky.made?.[id];
      const file = made?.file ?? scene.overlays?.[id];
      return file ? [{ id, file, ...(made ? { images: made.images } : {}) }] : [];
    }),
  ];
  const materials: Record<string, NonNullable<MaterialSettingsMap[string]>> = { ...sky.materials };
  for (const { id, file } of worn) {
    if (!id) continue;
    for (const name of Object.keys(file.materials)) {
      const key = materialKey(name, id);
      const settings = mergeSettings(sky.base?.[name], sky.materials?.[key]);
      if (settings) materials[key] = settings;
      else delete materials[key];
    }
  }
  return {
    worn,
    materials,
    ...stackedTints(sky),
    ...(sky.anchor ? { anchor: sky.anchor } : {}),
    ...(sky.order ? { order: sky.order } : {}),
    ...(sky.parts ? { parts: sky.parts } : {}),
  };
}
