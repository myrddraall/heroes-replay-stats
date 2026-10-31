import { drawnTints } from '../tints/tint-layers';
import { MAX_TINTS } from './uniforms/limits';
import { haloLike } from '../formats/planet-files';
import {
  DEFAULT_ACTIVE,
  gridFields,
  MATERIAL_DEFAULTS,
  type MaterialDepth,
  type MaterialSettings,
  materialValues,
  withLayers,
} from '../materials/material-settings';
import { rimTurn } from '../space/directions';
import { type SkyAnchor, skyAnchorOf } from '../sky/sky-anchors';
import {
  type AddedLight,
  addedLighting,
  bodyDarkenings,
  linkedSettings,
  reaches,
  tunedRig,
  withAddedLights,
  withLightSettings,
} from '../lights/lights';
import { withMasks } from '../formats/wear';
import type { DrawnBody } from '../bodies/drawn-body';
import { UniformSet } from './uniforms/uniforms';
import {
  gridUniforms,
  lightUniforms,
  materialUniforms,
  partUniforms,
  scrollingLayers,
  shadeUniforms,
  tintsUniforms,
} from './uniforms/draw-uniforms';
import { drawTurnOf } from '../space/graph';
import type { BodyLeans } from './bodies/body-frames';
import type { DrawState, MeshDraw } from './draw-types';
import { HEX_ROUND } from './tuning';
import { moves, shown } from './bodies/body-draws';

/** What working a draw out reads of the scene it is in. */
export interface DrawContext {
  /** A draw's material's settings in effect (the sky's, or its body's with its overlays'). */
  settingsOf(draw: MeshDraw): MaterialSettings | undefined;
  hasTexture(key: string): boolean;
  /** The lights added to a body (the scene's, and its own); none for the sky. */
  addedTo(body: DrawnBody | undefined): readonly AddedLight[];
  /** How the sky is anchored where a material doesn't say. */
  skyAnchor(): SkyAnchor | undefined;
  /** Where a draw is drawn among the scene's objects. */
  depthOf(name: string, settings: MaterialSettings | undefined, placed: boolean): MaterialDepth;
  /** The scene's exposure and its bloom threshold. */
  exposure(): number;
  /** How bright what is drawn dimmed is (see `Renderer.dim`). */
  dim(): number;
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
  const body = draw.placed?.body;
  const unshaded =
    !!draw.part &&
    (draw.part.pattern?.kind === 'hex' ||
      (settings?.lit !== undefined ? !settings.lit : layered.unshaded) ||
      (!draw.light && !addedLighting(ctx.addedTo(body), body?.lights)));
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
  tintsUniforms(u, 'uTint', drawnTints(settings, MAX_TINTS));
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
  if (!draw.part || !draw.placed || !body || !draw.bodyDraw) {
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
  const { part } = draw.bodyDraw;
  partUniforms(u, part);
  const rig = material.unshaded ? undefined : draw.light;
  const turned = rig && tunedRig(rig, body.lighting, body.lightFrom);
  const added = ctx.addedTo(body);
  const linked = linkedSettings(body.lights, added, draw.partKey, draw.key);
  const { shade } = body;
  const exposure = ctx.exposure();
  const light = material.unshaded
    ? undefined
    : withAddedLights(turned && withLightSettings(turned, linked), added, linked, exposure, shade);
  lightUniforms(u, light, exposure);
  const shine = materialValues(material, settings);
  u.f1('uSpecularMult', shine.specular);
  u.f1('uSpecularity', shine.glossiness);
  tintsUniforms(u, 'uBodyTint', drawnTints(body, MAX_TINTS));
  const { rim } = body;
  u.v2('uRimTurn', rim ? rimTurn(rim) : [0, 0]);
  // Which way it is turned: its material's say, else its part's, else a halo square to the
  // camera, else its body's (its tuning's where it sets none), else facing the camera.
  const { orientation, turned: takesTurn } = drawTurnOf(
    settings?.orientation,
    draw.bodyDraw.partOrientation,
    !!draw.owner && haloLike(draw.part, draw.owner.planet.materials),
    body.orientation,
  );
  const leans: BodyLeans = {
    ...(rim ? { rim } : {}),
    ...(settings?.spreadFrom ? { spreadFrom: settings.spreadFrom } : {}),
  };
  const darkenings = bodyDarkenings(
    draw.light && tunedRig(draw.light, body.lighting, body.lightFrom),
    shade,
    added,
    linked,
  );
  shadeUniforms(u, darkenings);
  // How far the material lets every light on it round, and how sharply its light falls off.
  u.f1('uWrap', shine.wrap);
  u.f1('uDropOff', shine.dropOff);
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
  u.f1('uGlowThreshold', body.glowRig?.bloomThreshold ?? ctx.sceneThreshold());
  // Outside what is taken in of its body (what a light reaches of it): dimmed.
  const outside = !!body.dimmedOutside && !reaches(body.dimmedOutside, draw.partKey, draw.key);
  u.f1('uDim', outside ? ctx.dim() : 1);
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
