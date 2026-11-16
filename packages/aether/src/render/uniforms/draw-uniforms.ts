import {
  layerOffset,
  type LayerChannel,
  type SceneBlend,
  type SceneLayer,
  type SceneMaterial,
} from '../../formats/play-scene';
import { GridField } from '../../materials/material-settings';
import {
  MAX_STOPS,
  type TintLayer,
  type TintMaskChannel,
  type TintMaskLayer,
} from '../../tints/tint-layers';
import { rimTurn } from '../../space/directions';
import { type Darkening, rgbOf } from '../../lights/lights';
import { axisOf, type PartMapping } from '../../formats/part-shapes';
import type { BodyPart, PlanetLight } from '../../formats/planet-files';
import { MAX_FIELDS, MAX_LIGHTS, MAX_SHADES, V_SAMPLES } from './limits';
import { BLEND_MODES, parseCanvasColour } from '../../tints/tints';
import { MAX_GRADES, toneRange, whiteBalance } from '../../tints/grading';
import { GRADE_ROWS } from './shader-uniforms';
import type { UniformSet } from './uniforms';
import { type Vec3, normalized } from '../../space/vectors';

/** A layer's channel as the shaders number it. */
export const CHANNELS: Record<LayerChannel, number> = { rgb: 0, rgba: 1, a: 2, r: 3, g: 4, b: 5 };
/** A material's layer slots, in the shader's order, and their samplers. */
export const SLOTS = ['uDiffuse', 'uEmissive', 'uMask0', 'uMask1', 'uSpecular'] as const;

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

/** A tint's kind, stage, mask and mask channel as the shader numbers them. */
const TINT_KINDS: Partial<Record<TintLayer['kind'], number>> = {
  colour: 0,
  hsl: 1,
  gradient: 2,
  levels: 3,
};
/** A grading tint on the light's kind as the tone pass numbers it. */
const GRADE_KINDS: Partial<Record<TintLayer['kind'], number>> = {
  'white-balance': 0,
  'brightness-contrast': 1,
  'lift-gamma-gain': 2,
};
const TINT_MASK_LAYERS: Record<TintMaskLayer, number> = { diffuse: 0, emissive: 1, mask1: 2, mask2: 3 };
const TINT_CHANNELS: Record<TintMaskChannel, number> = { r: 0, g: 1, b: 2, a: 3, luma: 4 };

/**
 * An object's tints as drawn (`drawnTints`) into the uniforms the tint packs read (`<prefix>A` to
 * `<prefix>I`, one vec4 each a tint, and `<prefix>Count`): the material's own (`uTint`) or its
 * body's, the sky's for the sky (`uBodyTint`). Each tint's rows: A its colour and strength; B its
 * kind, blend, stage (1 before it is lit) and how many stops; C its hue turn (radians),
 * saturation and lightness; D its mask's kind (0 none, 1 a layer's channel, 2 facing), layer,
 * channel and whether inverted; E a facing mask's from and to; F to I its gradient's stops (colour, at);
 * a levels tint's F its input's low, high and gamma, G its output's low and high.
 */
export function tintsUniforms(u: UniformSet, prefix: string, tints: readonly TintLayer[]): void {
  const rows = Array.from({ length: 9 }, () => new Array<number>(tints.length * 4).fill(0));
  tints.forEach((t, i) => {
    const put = (row: number, values: readonly number[]) =>
      values.forEach((v, c) => (rows[row]![i * 4 + c] = v));
    const colour = t.kind === 'colour' ? (parseCanvasColour(t.colour) ?? [1, 1, 1]) : [1, 1, 1];
    put(0, [...colour, t.strength]);
    const stops = t.kind === 'gradient' ? t.stops.slice(0, MAX_STOPS) : [];
    put(1, [
      TINT_KINDS[t.kind] ?? 0,
      t.kind === 'colour' ? BLEND_MODES[t.blend] : 0,
      t.stage === 'surface' ? 1 : 0,
      stops.length,
    ]);
    if (t.kind === 'hsl') put(2, [(t.hue * Math.PI) / 180, t.saturation, t.lightness, 0]);
    const mask = t.mask;
    put(3, [
      !mask ? 0 : mask.by === 'layer' ? 1 : 2,
      mask?.by === 'layer' ? TINT_MASK_LAYERS[mask.layer] : 0,
      mask?.by === 'layer' ? TINT_CHANNELS[mask.channel] : 0,
      mask?.invert ? 1 : 0,
    ]);
    if (mask?.by === 'facing') put(4, [mask.from, mask.to, 0, 0]);
    [...stops]
      .sort((a, b) => a.at - b.at)
      .forEach((stop, k) => put(5 + k, [...(parseCanvasColour(stop.colour) ?? [0, 0, 0]), stop.at]));
    if (t.kind === 'levels') {
      put(5, [t.inputLow, t.inputHigh, t.gamma, 0]);
      put(6, [t.outputLow, t.outputHigh, 0, 0]);
    }
  });
  'ABCDEFGHI'.split('').forEach((r, k) => u.fv(`${prefix}${r}`, rows[k]!, '4fv'));
  u.i1(`${prefix}Count`, tints.length);
}

/**
 * A scene's grading on the light, and the one it fades from (`MAX_GRADES` on in the pack), into
 * the uniforms the tone pass reads (`uGradeA` to `uGradeD`, `uGradeCount0` and `uGradeCount1`).
 * Each tint's rows: A its kind (0 white balance, 1 brightness and contrast, 2 lift/gamma/gain) and
 * strength; B white balance's multiplier, brightness's (2 to its stops) and contrast, or lift's
 * offset; C gamma's power (one over it); D gain's slope.
 */
export function gradesUniforms(
  u: UniformSet,
  shown: readonly TintLayer[],
  from: readonly TintLayer[],
): void {
  const rows = Array.from({ length: GRADE_ROWS }, () => new Array<number>(2 * MAX_GRADES * 4).fill(0));
  const fill = (tints: readonly TintLayer[], first: number) =>
    tints.slice(0, MAX_GRADES).forEach((t, k) => {
      const i = first + k;
      const put = (row: number, values: readonly number[]) =>
        values.forEach((v, c) => (rows[row]![i * 4 + c] = v));
      put(0, [GRADE_KINDS[t.kind] ?? 0, t.strength, 0, 0]);
      if (t.kind === 'white-balance') put(1, whiteBalance(t.temperature, t.tint));
      else if (t.kind === 'brightness-contrast') put(1, [2 ** t.brightness, t.contrast, 0]);
      else if (t.kind === 'lift-gamma-gain') {
        put(1, toneRange(t.lift));
        put(2, toneRange(t.gamma).map((g) => 1 / Math.max(0.01, g)));
        put(3, toneRange(t.gain));
      }
    });
  fill(shown, 0);
  fill(from, MAX_GRADES);
  'ABCD'.split('').forEach((r, k) => u.fv(`uGrade${r}`, rows[k]!, '4fv'));
  u.i1('uGradeCount0', Math.min(shown.length, MAX_GRADES));
  u.i1('uGradeCount1', Math.min(from.length, MAX_GRADES));
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
  // Add's light is added by its colour alone (alphaAdd's by its alpha masks too: m3studio's
  // material blends, "transparent on the basis of color value").
  u.i1('uAddsByColour', blend === 'add' ? 1 : 0);
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
  u.fv('uLightWrap', [
    ...lights.map((l) => l.wrap ?? 0),
    ...Array<number>(MAX_LIGHTS - lights.length).fill(0),
  ]);
  placedUniforms(u, 'uLight', lights, MAX_LIGHTS);
  u.fv('uLightGround', [...lights.flatMap((l) => [...(l.ground ?? [0, 0, 0])]), ...pad], '3fv');
  // The light's exposure over the scene's: the planet as bright as the tutorial shows it.
  u.f1('uLightScale', light.exposure / sceneExposure);
}

/** The kinds of light, as the shaders tell them apart (from a side: 0). */
export const LIGHT_KINDS = { point: 1, spot: 2, hemisphere: 3, environment: 4, rim: 5 } as const;

/**
 * Where each light is, for one from a point or a spot (and its kind, each light's): `<prefix>Kind`,
 * `Pos`, `Fade`, `Aim`, `Cone` (the cosines of its edge and of where its fade starts).
 */
function placedUniforms(
  u: UniformSet,
  prefix: string,
  lights: readonly {
    readonly kind?: 'point' | 'spot' | 'hemisphere' | 'environment' | 'rim';
    readonly position?: readonly number[];
    readonly fade?: number;
    readonly aim?: readonly number[];
    readonly cone?: number;
    readonly edge?: number;
  }[],
  max: number,
): void {
  const pad = (n: number) => Array<number>((max - lights.length) * n).fill(0);
  const rad = Math.PI / 180;
  u.iv(`${prefix}Kind`, [...lights.map((l) => (l.kind ? LIGHT_KINDS[l.kind] : 0)), ...pad(1)]);
  u.fv(
    `${prefix}Pos`,
    [...lights.flatMap((l) => [...(l.position ?? [0, 0, 0])]), ...pad(3)],
    '3fv',
  );
  u.fv(`${prefix}Fade`, [...lights.map((l) => l.fade ?? 1), ...pad(1)]);
  u.fv(`${prefix}Aim`, [...lights.flatMap((l) => [...(l.aim ?? [0, 0, 1])]), ...pad(3)], '3fv');
  u.fv(
    `${prefix}Cone`,
    [
      ...lights.flatMap((l) => {
        const cone = (l.cone ?? 90) * rad;
        return [Math.cos(cone), Math.cos(cone * (1 - (l.edge ?? 0))), 0, 0];
      }),
      ...pad(4),
    ],
    '4fv',
  );
}

/** What darkens a body's part, for the body shader (its shadow first, then the others; one from all round: no direction). */
export function shadeUniforms(u: UniformSet, darkenings: readonly Darkening[]): void {
  const shades = darkenings.slice(0, MAX_SHADES);
  const pad = (n: number) => Array<number>((MAX_SHADES - shades.length) * n).fill(0);
  u.i1('uShadeCount', shades.length);
  u.fv(
    'uShadeDir',
    [...shades.flatMap((s) => (s.direction ? [...normalized(s.direction)] : [0, 0, 0])), ...pad(3)],
    '3fv',
  );
  u.fv('uShadeColor', [...shades.flatMap((s) => [...s.colour]), ...pad(3)], '3fv');
  u.fv('uShadeStrength', [...shades.map((s) => s.strength), ...pad(1)]);
  u.fv('uShadeSoftness', [...shades.map((s) => s.softness), ...pad(1)]);
  u.fv('uShadeWrap', [...shades.map((s) => s.wrap ?? 0), ...pad(1)]);
  placedUniforms(u, 'uShade', shades, MAX_SHADES);
}

/**
 * A grid's reveals and activations (each at most MAX_FIELDS: its side, wrap, falloff and
 * strength, and by its kind where it is; the same uniforms a body's lights have, by prefix), its
 * colours (inactive in place of its diffuse's own where set, and active), and its rim: the kind
 * of its pattern layer's fresnel (`rimType`), drawn by its rim light in place of the layer's own.
 */
export function gridUniforms(
  u: UniformSet,
  reveals: readonly GridField[],
  activations: readonly GridField[],
  inactive: string | undefined,
  active: string,
  rimType: number,
): void {
  const pad = <T>(list: readonly T[], fill: T): T[] => [
    ...list.slice(0, MAX_FIELDS),
    ...Array<T>(Math.max(0, MAX_FIELDS - list.length)).fill(fill),
  ];
  const from = (list: readonly GridField[]) =>
    pad(
      list.map((l) => (l.from ? [...normalized(l.from)] : [0, 0, 0])),
      [0, -1, 0],
    ).flat();
  const r = reveals.slice(0, MAX_FIELDS);
  u.i1('uRevealed', 1);
  u.i1('uRimType', rimType);
  // (The pattern layer's own fresnel is its rim light's now, not the layer's.)
  u.i1('uLayers[1].fresnel', 0);
  placedUniforms(u, 'uReveal', r, MAX_FIELDS);
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
  placedUniforms(u, 'uActivation', a, MAX_FIELDS);
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
    u.v3(at('pole'), normalized(mapping.axis));
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
 * where it is seen from (a ring's size does: set as its body is baked, by `ringScale`).
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
    u.v3('uShapeAxis', normalized(axisOf(shape)));
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else if (shape.kind === 'plane') {
    u.i1('uShape', 6);
    u.f4('uShapeSpan', shape.width, shape.height, 0, 0);
    u.v3('uShapeAxis', normalized(axisOf(shape)));
    u.v3('uShapeUp', normalized(shape.up ?? [0, 0, 1]));
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
    u.v3('uShapeAxis', normalized(axisOf(shape)));
    u.v3('uShapeCentre', shape.centre ?? [0, 0, 0]);
  } else {
    u.i1('uShape', 2);
  }
  mappingUniforms(u, 'uMap', part.mapping);
  mappingUniforms(u, 'uMap2', part.mapping2 ?? part.mapping);
  const c = part.color ?? [255, 255, 255, 255];
  u.f4('uPartColor', c[0] / 255, c[1] / 255, c[2] / 255, c[3] / 255);
}
