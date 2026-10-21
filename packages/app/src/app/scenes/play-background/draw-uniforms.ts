import {
  layerOffset,
  type LayerChannel,
  type SceneBlend,
  type SceneLayer,
  type SceneMaterial,
} from './play-scene';
import type { GridField } from './material-settings';
import { rimTurn } from './scene-directions';
import { type Darkening, rgbOf } from './scene-lights';
import {
  axisOf,
  type BodyPart,
  type MaterialTint,
  type PartMapping,
  type PlanetLight,
} from './scene-planets';
import { MAX_FIELDS, MAX_LIGHTS, MAX_SHADES, V_SAMPLES } from './scene-shaders';
import { BLEND_MODES, parseCanvasColour } from './scene-tints';
import type { UniformSet } from './scene-uniforms';

type Vec3 = readonly [number, number, number];

/** A layer's channel as the shaders number it. */
export const CHANNELS: Record<LayerChannel, number> = { rgb: 0, rgba: 1, a: 2, r: 3, g: 4, b: 5 };
/** A material's layer slots, in the shader's order, and their samplers. */
export const SLOTS = ['uDiffuse', 'uEmissive', 'uMask0', 'uMask1', 'uSpecular'] as const;

const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * How strongly a layer's brightness multiplier acts: the data's value, squared. Measured, as the
 * data doesn't say: against a screenshot of the game's Play screen, squared multipliers give its
 * colours (within 1-4 levels of 255), the faint energy wisps and the faint stars' count; taken as
 * they are, the energy's wisps came out about three times too strong and the stars too few.
 */
export function layerBrightness(brightMult: number): number {
  return brightMult * brightMult;
}

/** A material's layers in the shader's slots (diffuse, emissive, the two masks, specular). */
export const layersOf = (m: SceneMaterial): readonly (SceneLayer | null | undefined)[] => [
  m.diffuse,
  m.emissive,
  m.alphaMasks[0],
  m.alphaMasks[1],
  m.specular,
];

/** A tint into the uniforms `<name>Color`, `<name>Blend` and `<name>Strength` (none: strength 0). */
export function tintUniforms(u: UniformSet, name: string, tint: MaterialTint | undefined): void {
  const colour = tint ? parseCanvasColour(tint.colour) : null;
  u.f1(`${name}Strength`, colour && tint ? tint.strength : 0);
  if (!colour || !tint) return;
  u.v3(`${name}Color`, colour);
  u.i1(`${name}Blend`, BLEND_MODES[tint.blend]);
}

/**
 * A material's uniforms (its layers at time 0: a scrolling layer's offset is set as it is drawn,
 * `layerOffset`). `emissiveScale` sizes the emissive layer's pattern (its tiling over it: 2, twice
 * the size); `blend` is the blend it is drawn with (its own, or its settings'); `spreadFrom`,
 * where set, is the side its layers' fresnel is brightest on, in place of their own turn (which
 * leans the other way). `textured` says whether a layer's texture is there to read.
 */
export function materialUniforms(
  u: UniformSet,
  material: SceneMaterial,
  emissiveScale: number,
  blend: SceneBlend,
  textured: (layer: SceneLayer) => boolean,
  spreadFrom?: Vec3,
): void {
  const turn = spreadFrom ? rimTurn(spreadFrom).map((a) => -a) : null;
  layersOf(material).forEach((layer, i) => {
    const at = (field: string) => `uLayers[${i}].${field}`;
    u.i1(at('used'), layer ? 1 : 0);
    u.i1(SLOTS[i]!, i);
    if (!layer) return;
    u.i1(at('textured'), textured(layer) ? 1 : 0);
    const color = layer.color ?? [255, 255, 255, 255];
    u.f4(at('color'), color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255);
    u.i1(at('uvSet'), layer.uvSet ?? 1);
    u.i1(at('channel'), CHANNELS[layer.channel ?? 'rgb']);
    u.f1(at('bright'), layerBrightness(layer.brightMult));
    u.f1(at('midtone'), layer.midtone ?? 0);
    u.v2(at('offset'), layerOffset(layer, 0));
    u.f1(at('angle'), layer.angle ?? 0);
    const tiling = layer.tiling ?? [1, 1];
    const scale = i === 1 ? emissiveScale : 1;
    u.f2(at('tiling'), tiling[0] / scale, tiling[1] / scale);
    const f = layer.fresnel;
    u.i1(at('fresnel'), f?.type ?? 0);
    u.f1(at('fExponent'), f?.exponent ?? 1);
    u.f1(at('fMin'), f?.min ?? 0);
    u.f1(at('fMax'), f?.max ?? 1);
    u.f2(at('fTurn'), turn?.[0] ?? f?.yaw ?? 0, turn?.[1] ?? f?.pitch ?? 0);
  });
  u.i1('uUnshaded', material.unshaded ? 1 : 0);
  u.i1('uVertexAlpha', material.vertexAlpha ? 1 : 0);
  u.i1('uVertexColor', material.vertexColor ? 1 : 0);
  u.f1('uEmissiveMult', material.emissiveMult);
  u.i1('uOpaque', blend === 'opaque' ? 1 : 0);
  u.i1('uEmissiveBlend', { mod: 0, mod2x: 1, add: 2 }[material.emissiveBlend ?? 'add']);
  u.f1('uCutout', material.cutout ?? 0);
  // Not a grid unless set as one (`gridUniforms`): its layers' own fresnel, its own colour.
  u.i1('uRevealed', 0);
  u.i1('uActivationCount', 0);
}

/** The layers of a material that scroll, by slot: their offsets are set as they are drawn. */
export function scrollingLayers(
  material: SceneMaterial,
): readonly { readonly slot: number; readonly layer: SceneLayer }[] {
  return layersOf(material).flatMap((layer, slot) => (layer?.scroll ? [{ slot, layer }] : []));
}

/** How a body's part is lit, for the body shader: not at all (no rig), or by its rig. */
export function lightUniforms(
  u: UniformSet,
  light: PlanetLight | undefined,
  sceneExposure: number,
): void {
  u.i1('uLit', light ? 1 : 0);
  if (!light) return;
  const lights = light.directional.slice(0, MAX_LIGHTS);
  const pad = Array<number>((MAX_LIGHTS - lights.length) * 3).fill(0);
  u.v3('uAmbient', light.ambient);
  u.i1('uLightCount', lights.length);
  u.fv('uLightDir', [...lights.flatMap((l) => [...l.direction]), ...pad], '3fv');
  u.fv('uLightColor', [...lights.flatMap((l) => [...l.color]), ...pad], '3fv');
  u.fv('uLightSpecular', [...lights.flatMap((l) => [...(l.specular ?? [0, 0, 0])]), ...pad], '3fv');
  u.fv('uLightSoftness', [
    ...lights.map((l) => l.softness ?? 1),
    ...Array<number>(MAX_LIGHTS - lights.length).fill(1),
  ]);
  // The light's exposure over the scene's: the planet as bright as the tutorial shows it.
  u.f1('uLightScale', light.exposure / sceneExposure);
}

/** What darkens a body's part, for the body shader (its shadow first, then the others; one from all round: no direction). */
export function shadeUniforms(u: UniformSet, darkenings: readonly Darkening[]): void {
  const shades = darkenings.slice(0, MAX_SHADES);
  const pad = (n: number) => Array<number>((MAX_SHADES - shades.length) * n).fill(0);
  u.i1('uShadeCount', shades.length);
  u.fv(
    'uShadeDir',
    [...shades.flatMap((s) => (s.direction ? [...normalize(s.direction)] : [0, 0, 0])), ...pad(3)],
    '3fv',
  );
  u.fv('uShadeColor', [...shades.flatMap((s) => [...s.colour]), ...pad(3)], '3fv');
  u.fv('uShadeStrength', [...shades.map((s) => s.strength), ...pad(1)]);
  u.fv('uShadeSoftness', [...shades.map((s) => s.softness), ...pad(1)]);
}

/**
 * A grid's reveals and activations (each at most MAX_FIELDS) and its colours: inactive in place
 * of its diffuse's own where set, and active.
 */
export function gridUniforms(
  u: UniformSet,
  reveals: readonly GridField[],
  activations: readonly GridField[],
  inactive: string | undefined,
  active: string,
): void {
  const pad = <T>(list: readonly T[], fill: T): T[] => [
    ...list.slice(0, MAX_FIELDS),
    ...Array<T>(Math.max(0, MAX_FIELDS - list.length)).fill(fill),
  ];
  const from = (list: readonly GridField[]) =>
    pad(
      list.map((l) => (l.from ? [...normalize(l.from)] : [0, 0, 0])),
      [0, -1, 0],
    ).flat();
  const r = reveals.slice(0, MAX_FIELDS);
  u.i1('uRevealed', 1);
  u.i1('uRevealCount', r.length);
  u.fv('uRevealFrom', from(r), '3fv');
  u.fv(
    'uRevealSpread',
    pad(
      r.map((l) => l.reach),
      0,
    ),
  );
  u.fv(
    'uRevealFalloff',
    pad(
      r.map((l) => l.falloff),
      1,
    ),
  );
  u.fv(
    'uRevealStrength',
    pad(
      r.map((l) => l.strength),
      0,
    ),
  );
  const a = activations.slice(0, MAX_FIELDS);
  u.i1('uActivationCount', a.length);
  u.fv('uActivationFrom', from(a), '3fv');
  u.fv(
    'uActivationSpread',
    pad(
      a.map((l) => l.reach),
      0,
    ),
  );
  u.fv(
    'uActivationFalloff',
    pad(
      a.map((l) => l.falloff),
      1,
    ),
  );
  u.fv(
    'uActivationStrength',
    pad(
      a.map((l) => l.strength),
      0,
    ),
  );
  u.fv(
    'uActivationEnergy',
    pad(
      a.map((l) => l.energizes ?? 0),
      0,
    ),
  );
  u.fv(
    'uActivationGlow',
    pad(
      a.map((l) => l.glow ?? 0),
      0,
    ),
  );
  u.v3('uActiveColor', rgbOf(active, 1));
  if (inactive) {
    const c = rgbOf(inactive, 1);
    u.f4('uLayers[0].color', c[0], c[1], c[2], 1);
  }
}

/** A part's mapping to texture coordinates, for the body shader, into its uniform struct. */
export function mappingUniforms(u: UniformSet, name: string, mapping: PartMapping): void {
  const at = (field: string) => `${name}.${field}`;
  if (mapping.kind === 'sphere') {
    u.i1(at('kind'), 0);
    u.v3(at('pole'), mapping.pole);
    u.v3(at('meridian'), mapping.meridian);
    u.f4(at('a'), mapping.flip ? 1 : 0, mapping.u0, 0, 0);
    if (mapping.v.length !== V_SAMPLES)
      throw new Error(`a planet's v table has ${mapping.v.length} values, not ${V_SAMPLES}`);
    u.fv(at('v[0]'), mapping.v);
  } else if (mapping.kind === 'linear') {
    u.i1(at('kind'), 1);
    u.fv(at('a'), mapping.u, '4fv');
    u.fv(at('b'), mapping.v, '4fv');
  } else if (mapping.kind === 'round') {
    u.i1(at('kind'), 3);
    u.v3(at('pole'), normalize(mapping.axis));
    u.v3(at('meridian'), mapping.meridian);
    u.f4(at('a'), mapping.flip ? 1 : 0, mapping.u0, mapping.v0, mapping.v1);
    u.f4(at('b'), mapping.repeat, mapping.along === 'radius' ? 1 : 0, 0, 0);
  } else {
    u.i1(at('kind'), 2);
    u.f4(at('a'), mapping.from, mapping.uMax, mapping.mid ?? 0.5, 0);
  }
}

/**
 * A body's part's shape, mappings and colour, for the body shader, as far as they don't depend on
 * where it is seen from (a ring's size does: see `SceneRenderer`).
 */
export function partUniforms(u: UniformSet, part: BodyPart): void {
  const { shape } = part;
  if (shape.kind === 'sphere') {
    u.i1('uShape', shape.side === 'near' ? 0 : 1);
    u.f3('uShapeParams', shape.radius, 0, 0);
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else if (shape.kind === 'capsule') {
    u.i1('uShape', shape.side === 'near' ? 7 : 8);
    u.f4('uShapeSpan', shape.radius, shape.radius, -shape.length / 2, shape.length / 2);
    u.v3('uShapeAxis', normalize(axisOf(shape)));
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else if (shape.kind === 'plane') {
    u.i1('uShape', 6);
    u.f4('uShapeSpan', shape.width, shape.height, 0, 0);
    u.v3('uShapeAxis', normalize(axisOf(shape)));
    u.v3('uShapeUp', normalize(shape.up ?? [0, 0, 1]));
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else if (shape.kind === 'tube' || shape.kind === 'cone' || shape.kind === 'disc') {
    // A frustum (a tube: as wide at both ends) or a disc about its axis, from its centre.
    const [r0, r1] =
      shape.kind === 'tube'
        ? [shape.radius, shape.radius]
        : shape.kind === 'cone'
          ? [shape.bottom, shape.top]
          : [shape.inner, shape.outer];
    const half = shape.kind === 'disc' ? 0 : shape.length / 2;
    u.i1('uShape', shape.kind === 'disc' ? 5 : shape.side === 'near' ? 3 : 4);
    u.f4('uShapeSpan', r0, r1, -half, half);
    u.v3('uShapeAxis', normalize(axisOf(shape)));
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else {
    u.i1('uShape', 2);
  }
  mappingUniforms(u, 'uMap', part.mapping);
  mappingUniforms(u, 'uMap2', part.mapping2 ?? part.mapping);
  const c = part.color ?? [255, 255, 255, 255];
  u.f4('uPartColor', c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
}
