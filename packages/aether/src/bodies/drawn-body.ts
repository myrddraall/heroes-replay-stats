import {
  type BodyPart,
  type BodyShade,
  DEFAULT_SHADE,
  type PlanetLight,
  poleOf,
} from '../formats/planet-files';
import type { LoadedPlanet } from '../formats/planet-loader';
import { overlayOfFile } from '../formats/overlay-files';
import { ownPartKey, overlayPartKey, type PartKey } from '../formats/part-keys';
import { withPart } from '../formats/part-shapes';
import { wearOf, wornParts } from '../formats/wear';
import type { AddedLight, LightSettingsMap } from '../lights/lights';
import {
  materialKey,
  type MaterialSettings,
  type MaterialTint,
  mergeSettings,
} from '../materials/material-settings';
import { bodyTurn, type Mat3, type Orientation } from '../space/graph';
import type { PlanetPlacement } from '../space/space';
import type { Vec3 } from '../space/vectors';

/**
 * A body as the renderer draws it, worked out from its placement: each material of each of its
 * parts (its overlays' among them) with its settings come to (its file's tuning, how its planet
 * wears its overlay, the settings over those), and its own values with its tuning's under them.
 * The renderer reads nothing else of a body, so it knows nothing of how its settings are kept.
 */
export interface DrawnBody {
  readonly id: string;
  readonly label?: string;
  /** Its planet's file, then its overlays', as loaded (their textures, and which body it is). */
  readonly files: readonly LoadedPlanet[];
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
  /** Not drawn (nor picked), though where it is: switched off. */
  readonly hidden: boolean;
  /** Drawn dimmed, by the renderer's `dim` (outside what an editor is in). */
  readonly dimmed: boolean;
  /** Its own turn: its base turn, then about its Axis by its Turn (see `bodyTurn`). */
  readonly turn: Mat3;
  /** Its parts as set (`part`), each with the part it is of (`source`). */
  readonly parts: readonly { readonly source: BodyPart; readonly part: BodyPart }[];
  readonly draws: readonly BodyDraw[];
  /** Its materials' draw order, by `materialKey`, where set (see `drawOrder`). */
  readonly order?: readonly string[];
  /** The rig its lit materials are lit by: its first overlay's that has one, else its planet's. */
  readonly rig?: PlanetLight;
  /** The rig whose bloom threshold its glow takes: its overlays' where it wears any, else its planet's. */
  readonly glowRig?: PlanetLight;
  /** Its rig made stronger and turned (see `tunedRig`), its tuning's where it sets none. */
  readonly lighting?: number;
  readonly lightFrom?: Vec3;
  readonly tint?: MaterialTint;
  /** Where its rims and glows lean, its tuning's where it sets none. */
  readonly rim?: Vec3;
  /** Which way its surfaces are turned, its tuning's where it sets none. */
  readonly orientation?: Orientation;
  /** Its lights' settings, by light, over its rig's and its shade. */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (its own and its overlays'), after its rig's. */
  readonly added?: readonly AddedLight[];
  /** Its shade: the defaults, its tuning's, its overlays', its own. */
  readonly shade: BodyShade;
}

/** One material of one part of a drawn body. */
export interface BodyDraw {
  /** The material's name. */
  readonly name: string;
  /** What its settings are kept by (see `materialKey`). */
  readonly key: string;
  /** The overlay it is of, where it is an overlay's. */
  readonly overlay?: string;
  /** The planet's or overlay's file it is of: its materials and textures. */
  readonly file: LoadedPlanet;
  /** Its part's place among its file's parts as worn. */
  readonly index: number;
  /** Its part as its file has it, and as set. */
  readonly source: BodyPart;
  readonly part: BodyPart;
  readonly partKey: PartKey;
  /** Whether its part is shown. */
  readonly partShown: boolean;
  /** Which way its part is turned, where its settings say. */
  readonly partOrientation?: Orientation;
  /** Its settings come to, where any level sets any. */
  readonly settings?: MaterialSettings;
}

const drawn = new WeakMap<PlanetPlacement, DrawnBody>();

/** A placement as drawn (the same placement, the same body: what is worked out of it is kept). */
export function drawnBody(placement: PlanetPlacement): DrawnBody {
  let body = drawn.get(placement);
  if (!body) drawn.set(placement, (body = drawBody(placement)));
  return body;
}

function drawBody(placement: PlanetPlacement): DrawnBody {
  const { planet } = placement;
  const file = planet.planet;
  const tuning = file.tuning;
  const overlays = placement.overlays ?? [];
  const worn = (o: LoadedPlanet) => wornParts(file, overlayOfFile(o.id), o.planet.parts);
  const parts = [
    ...file.parts.map((p) => ({ source: p, part: withPart(p, placement.parts?.[ownPartKey(p)]) })),
    ...overlays.flatMap((o) =>
      worn(o).map((p) => ({
        source: p,
        part: withPart(p, placement.parts?.[overlayPartKey(overlayOfFile(o.id), p)]),
      })),
    ),
  ];
  const draws: BodyDraw[] = [];
  for (const loaded of [planet, ...overlays]) {
    const own = loaded === planet;
    const overlay = own ? undefined : overlayOfFile(loaded.id);
    const wear = overlay ? wearOf(file, overlay) : undefined;
    (own ? loaded.planet.parts : worn(loaded)).forEach((source, index) => {
      const partKey = overlay ? overlayPartKey(overlay, source) : ownPartKey(source);
      const set = placement.parts?.[partKey];
      for (const name of source.materials) {
        const key = materialKey(name, overlay);
        const settings = mergeSettings(
          loaded.planet.tuning?.materials?.[name],
          wear?.materials?.[name],
          overlay ? placement.base?.[name] : undefined,
          placement.materials?.[key],
        );
        draws.push({
          name,
          key,
          ...(overlay ? { overlay } : {}),
          file: loaded,
          index,
          source,
          part: withPart(source, set),
          partKey,
          partShown: set?.enabled !== false,
          ...(set?.orientation ? { partOrientation: set.orientation } : {}),
          ...(settings ? { settings } : {}),
        });
      }
    });
  }
  const glowRig = overlays.length ? overlays.find((o) => o.planet.light)?.planet.light : file.light;
  const { rig, lighting, lightFrom, shade } = bodyRigOf(placement);
  const tint = placement.tint ?? tuning?.tint;
  const rim = placement.rim ?? tuning?.rim;
  const orientation = placement.orientation ?? tuning?.orientation;
  return {
    id: planet.id,
    ...(planet.label !== undefined ? { label: planet.label } : {}),
    files: [planet, ...overlays],
    position: placement.position,
    radius: placement.radius,
    hidden: !!placement.hidden,
    dimmed: !!placement.dimmed,
    turn: bodyTurn(
      poleOf(file.parts),
      placement.axis ?? tuning?.axis,
      placement.turn ?? tuning?.turn,
      placement.baseTurn ?? tuning?.baseTurn,
    ),
    parts,
    draws,
    ...(placement.order ? { order: placement.order } : {}),
    ...(rig ? { rig } : {}),
    ...(glowRig ? { glowRig } : {}),
    ...(lighting !== undefined ? { lighting } : {}),
    ...(lightFrom ? { lightFrom } : {}),
    ...(tint ? { tint } : {}),
    ...(rim ? { rim } : {}),
    ...(orientation ? { orientation } : {}),
    ...(placement.lights ? { lights: placement.lights } : {}),
    ...(placement.added ? { added: placement.added } : {}),
    shade,
  };
}

/** What lights a body as placed: its rig (see `DrawnBody`), as made stronger and turned, and its shade. */
export function bodyRigOf(placement: PlanetPlacement): {
  readonly rig?: PlanetLight;
  readonly lighting?: number;
  readonly lightFrom?: Vec3;
  readonly shade: BodyShade;
} {
  const file = placement.planet.planet;
  const tuning = file.tuning;
  const overlays = placement.overlays ?? [];
  const rig = overlays.find((o) => o.planet.light)?.planet.light ?? file.light;
  const lighting = placement.lighting ?? tuning?.lighting;
  const lightFrom = placement.lightFrom ?? tuning?.lightFrom;
  return {
    ...(rig ? { rig } : {}),
    ...(lighting !== undefined ? { lighting } : {}),
    ...(lightFrom ? { lightFrom } : {}),
    shade: {
      ...DEFAULT_SHADE,
      ...tuning?.shade,
      ...overlays.reduce(
        (a: Partial<BodyShade>, o) => ({
          ...a,
          ...o.planet.shade,
          ...wearOf(file, overlayOfFile(o.id))?.shade,
        }),
        {},
      ),
      ...placement.shade,
    },
  };
}
