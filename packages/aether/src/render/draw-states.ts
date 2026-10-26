import type { BodyShade } from '../formats/planet-files';
import {
  DEFAULT_ACTIVE,
  gridFields,
  MATERIAL_DEFAULTS,
  materialValues,
} from '../materials/material-settings';
import { rimTurn } from '../space/directions';
import { skyAnchorOf } from '../sky/sky-anchors';
import {
  type AddedLight,
  addedLighting,
  bodyDarkenings,
  linkedSettings,
  tunedRig,
  withAddedLights,
  withLightSettings,
} from '../lights/lights';
import { haloLike } from '../formats/planet-files';
import { withMasks } from '../formats/wear';
import {
  type MaterialDepth,
  type MaterialSettings,
  type SkyAnchor,
  withLayers,
} from '../formats/settings-types';
import { withPart } from '../formats/part-shapes';
import type { PlanetPlacement } from '../space/space';
import { UniformSet } from './uniforms';
import {
  gridUniforms,
  lightUniforms,
  materialUniforms,
  partUniforms,
  scrollingLayers,
  shadeUniforms,
  tintUniforms,
} from './draw-uniforms';
import { drawTurnOf } from '../space/graph';
import type { BodyLeans } from './body-frames';
import type { DrawState, MeshDraw } from './draw-types';
import { HEX_ROUND } from './tuning';
import { moves, overlaysOf, shown } from './body-draws';

/** What working a draw out reads of the scene it is in. */
export interface DrawContext {
  /** A draw's material's settings in effect (the sky's, or its body's with its overlays'). */
  settingsOf(draw: MeshDraw): MaterialSettings | undefined;
  hasTexture(key: string): boolean;
  /** The lights added to a body (the scene's, and its own); none for the sky. */
  addedTo(placement: PlanetPlacement | undefined): readonly AddedLight[];
  /** How the sky is anchored where a material doesn't say. */
  skyAnchor(): SkyAnchor | undefined;
  /** Where a draw is drawn among the scene's objects. */
  depthOf(name: string, settings: MaterialSettings | undefined, placed: boolean): MaterialDepth;
  /** A body's shade (its darkening). */
  shadeOf(placement: PlanetPlacement): BodyShade;
  /** The scene's exposure and its bloom threshold. */
  exposure(): number;
  sceneThreshold(): number;
}

/**
 * A draw worked out: its settings, its material as set, how it is lit, its uniforms (its GPU side
 * is found or made as it is drawn).
 */
export function drawStateOf(draw: MeshDraw, ctx: DrawContext): DrawState {
  const settings = ctx.settingsOf(draw);
  const has = (texture: string) => ctx.hasTexture(texture);
  const layered = withLayers(withMasks(draw.material, settings?.masks), settings?.layers, has);
  const placement = draw.placed?.placement;
  const unshaded =
    !!draw.part &&
    (draw.part.pattern?.kind === 'hex' ||
      (settings?.lit !== undefined ? !settings.lit : layered.unshaded) ||
      (!draw.light && !addedLighting(ctx.addedTo(placement), placement?.lights)));
  const material = draw.part && unshaded !== layered.unshaded ? { ...layered, unshaded } : layered;
  const moving = draw.moving || (material !== draw.material && moves(material));
  const blend = settings?.blend ?? draw.material.blend;
  const enabled = (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) && shown(draw);
  const anchor: SkyAnchor = draw.placed ? 'world' : skyAnchorOf(settings, ctx.skyAnchor());
  const depth = ctx.depthOf(draw.name, settings, !!draw.placed);
  const scale = settings?.scale ?? MATERIAL_DEFAULTS.scale;
  const u = new UniformSet();
  materialUniforms(
    u,
    material,
    scale,
    blend,
    (layer) => !!layer.texture && has(layer.texture),
    settings?.spreadFrom,
  );
  u.f1('uGlowBoost', settings?.glow ?? MATERIAL_DEFAULTS.glow);
  u.f1('uSpread', settings?.spread ?? -1);
  u.f1('uFalloff', settings?.falloff ?? MATERIAL_DEFAULTS.falloff);
  u.f1('uCut', settings?.cut ?? MATERIAL_DEFAULTS.cut);
  u.f1('uStrength', settings?.strength ?? MATERIAL_DEFAULTS.strength);
  tintUniforms(u, 'uTint', settings?.tint);
  const base = {
    draw,
    enabled,
    depth,
    anchor,
    blend,
    moving,
    material,
    uniforms: u,
    scrolls: scrollingLayers(material),
  };
  if (!draw.part || !draw.placed || !placement) {
    const tube = draw.tube;
    u.i1('uTube', tube ? 1 : 0);
    if (tube) {
      u.f4('uTubeShape', tube.centre[0], tube.centre[1], tube.radius, 0);
      u.f4('uTubeMap', ...tube.u, ...tube.v);
      u.f2('uTubeSpan', tube.low, tube.high);
    }
    return {
      ...base,
      signature: JSON.stringify([draw.key, settings ?? null, blend, depth, anchor, enabled]),
    };
  }
  const part = withPart(draw.part, draw.partKey && placement.parts?.[draw.partKey]);
  partUniforms(u, part);
  const tuning = placement.planet.planet.tuning;
  const rig = material.unshaded ? undefined : draw.light;
  const turned =
    rig &&
    tunedRig(rig, placement.lighting ?? tuning?.lighting, placement.lightFrom ?? tuning?.lightFrom);
  const added = ctx.addedTo(placement);
  const linked = linkedSettings(placement.lights, added, draw.partKey, draw.key);
  const shade = ctx.shadeOf(placement);
  const exposure = ctx.exposure();
  const light = material.unshaded
    ? undefined
    : withAddedLights(turned && withLightSettings(turned, linked), added, linked, exposure, shade);
  lightUniforms(u, light, exposure);
  const shine = materialValues(material, settings);
  u.f1('uSpecularMult', shine.specular);
  u.f1('uSpecularity', shine.glossiness);
  tintUniforms(u, 'uBodyTint', placement.tint ?? tuning?.tint);
  const rim = placement.rim ?? tuning?.rim;
  u.v2('uRimTurn', rim ? rimTurn(rim) : [0, 0]);
  // Which way it is turned: its material's say, else its part's, else a halo square to the
  // camera, else its body's, else its tuning's (each level over the one under it as merged),
  // else facing the camera.
  const { orientation, turned: takesTurn } = drawTurnOf(
    settings?.orientation,
    draw.partKey ? placement.parts?.[draw.partKey]?.orientation : undefined,
    !!draw.owner && haloLike(draw.part, draw.owner.planet.materials),
    placement.orientation,
    tuning?.orientation,
  );
  const leans: BodyLeans = {
    ...(rim ? { rim } : {}),
    ...(settings?.spreadFrom ? { spreadFrom: settings.spreadFrom } : {}),
  };
  const darkenings = bodyDarkenings(
    draw.light &&
      tunedRig(
        draw.light,
        placement.lighting ?? tuning?.lighting,
        placement.lightFrom ?? tuning?.lightFrom,
      ),
    shade,
    added,
    linked,
  );
  shadeUniforms(u, darkenings);
  const grid = draw.part.pattern?.kind === 'hex';
  if (grid) {
    const { reveal, activation } = gridFields(materialValues(material, settings));
    gridUniforms(
      u,
      reveal,
      activation,
      settings?.inactive,
      settings?.active ?? DEFAULT_ACTIVE,
      material.emissive?.fresnel?.type ?? 1,
    );
  }
  const worn = overlaysOf(placement);
  const own = worn.length
    ? worn.find((o) => o.planet.light)?.planet.light
    : placement.planet.planet.light;
  u.f1('uGlowThreshold', own?.bloomThreshold ?? ctx.sceneThreshold());
  const pattern = draw.part.pattern;
  const drawn = pattern?.kind === 'hex' && settings?.drawAs !== 'texture';
  const round = pattern?.across
    ? pattern.across * (material.emissive?.tiling?.[0] ?? 1)
    : HEX_ROUND;
  u.i1('uPattern', drawn ? 1 : 0);
  u.f3(
    'uPatternParams',
    round / scale,
    settings?.width ?? MATERIAL_DEFAULTS.width,
    settings?.soft ?? MATERIAL_DEFAULTS.soft,
  );
  return { ...base, part, orientation, turned: takesTurn, leans, signature: '' };
}
