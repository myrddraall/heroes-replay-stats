import {
  type LoadedPlayScene,
  layerOffset,
  type SceneBlend,
  type SceneLayer,
  type SceneMaterial,
  type SceneCamera,
  type SceneCameraSet,
  type SceneMesh,
  type SkyOverlayFile,
} from './play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from './scene-particles';
import {
  DEFAULT_ACTIVE,
  gridFields,
  MATERIAL_DEFAULTS,
  materialValues,
  materialKey,
  mergeSettings,
} from './material-settings';
import { rimTurn } from './scene-directions';
import {
  BEAM_LENGTH,
  beamAcross,
  beamTube,
  type LightAid,
  type LightOutline,
  OUTLINE_EXTENT,
} from './scene-beams';
import { fitTube, type Tube, tubeCover } from './scene-tubes';
import { overlayOfFile } from './overlays';
import { skyOverlayParts } from './sky-overlays';
import { skyDepths } from './sky-depths';
import {
  type AddedLight,
  addedLighting,
  bodyDarkenings,
  type LightSettingsMap,
  linkedSettings,
  withAddedLights,
  withLightSettings,
  tunedRig,
} from './scene-lights';
import {
  shapeReach,
  type BodyPart,
  type BodyShade,
  drawOrder,
  DEFAULT_SHADE,
  type LoadedPlanet,
  type MaterialDepth,
  type MaterialSettings,
  type MaterialSettingsMap,
  type MaterialTint,
  type SkySettings,
  type PlanetLight,
  wearOf,
  ownPartKey,
  overlayOfPartKey,
  overlayPartKey,
  type PartKey,
  type PartSettingsMap,
  withLayers,
  withPart,
  withMasks,
  wornParts,
} from './scene-planets';
import { BLEND_MODES, NO_TINT, type Tint } from './scene-tints';
import {
  BEAM_FRAGMENT,
  BEAM_VERTEX,
  OUTLINE_FRAGMENT,
  OUTLINE_VERTEX,
  BLOOM_FRAGMENT,
  BODY_VERTEX,
  bodyFragment,
  COMPOSITE_FRAGMENT,
  IMPOSTOR_FRAGMENT,
  IMPOSTOR_VERTEX,
  MAX_BEAM_SPHERES,
  MAX_SURFACES,
  MESH_VERTEX,
  meshFragment,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  TONE_FRAGMENT,
  TONE_VERTEX,
} from './scene-shaders';
import { applyBlock, compileBlock, type UniformBlock, UniformSet } from './scene-uniforms';
import { ATTRIBUTES, program, type Programs, programsOf } from './scene-programs';
import {
  CHANNELS,
  gridUniforms,
  layerBrightness,
  layersOf,
  lightUniforms,
  materialUniforms,
  partUniforms,
  scrollingLayers,
  shadeUniforms,
  tintUniforms,
} from './draw-uniforms';
import {
  bakeRect,
  bakeSize,
  frameSpot,
  type PixelRect,
  REBAKE_PIXELS,
  scrollPixels,
} from './body-bakes';
import { GpuTimer } from './gpu-timer';

export { layerBrightness } from './draw-uniforms';
export { V_SAMPLES } from './scene-shaders';

/**
 * What a draw writes: the colour, or the glow (what blooms beyond the scene's own bloom). Each goes
 * to a target of its own, in a pass of its own (the shaders' `uOutput`), never both at once: with
 * Direct3D (ANGLE), a program linked for one output is compiled again, uncached, the first time it
 * draws into two, and for the bodies' shader that takes the whole browser away for ten seconds or
 * more on every load. A body is baked twice only when it changes; per frame only what moves of the
 * sky is drawn twice (the particles glow not at all: drawn once).
 */
const OUTPUTS = ['colour', 'glow'] as const;
type Output = (typeof OUTPUTS)[number];

/** The keys the bodies' and the meshes' programs are kept under. */
const BODY = 'body';
const MESH = 'mesh';

/** How many hexes a drawn hex pattern has round a body at scale 1, where it doesn't say how many its texture has. */
const HEX_ROUND = 24;

/**
 * How strongly the bloom is added back, how many times it is blurred across and down, how far
 * apart its taps are (in its texels) and how much smaller than the canvas it is: together, how
 * far it spreads (about a tenth of the view's height).
 */
const BLOOM_STRENGTH = 1.5;
/** The sky light's texture: its size (square), its mipmap levels (down to one texel), and the texture unit the bodies read it on (past their materials' five). */
const SKY_LIGHT_SIZE = 64;
const SKY_LIGHT_LEVELS = 7;
const SKY_LIGHT_UNIT = 5;
const BLOOM_PASSES = 3;
const BLOOM_SPACING = 1.5;
const BLOOM_SCALE = 8;
/** The bloom's threshold where the light doesn't set one: the tutorial's lights' 0.6. */
const DEFAULT_BLOOM_THRESHOLD = 0.6;

/** How strongly a beam shows down its middle, by its body: one that lights, one that darkens. */
const BEAM_ALPHA = 0.35;
const DARK_BEAM_ALPHA = 0.7;
/** How strongly a dark beam's edges show. */
const BEAM_EDGE_ALPHA = 0.5;
/** How strongly a light's outline on its body shows. */
const OUTLINE_ALPHA = 0.85;

/**
 * An editing aid in place of the sky (none of the sky, its stars or particles drawn): a plain
 * colour, or a grid of two as image editors show transparency, its squares `size` CSS pixels.
 * Colours are 0 to 1, shown as they are.
 */
export type Backdrop =
  | { readonly kind: 'colour'; readonly colour: Vec3 }
  | { readonly kind: 'grid'; readonly size: number; readonly colours: readonly [Vec3, Vec3] };

type Vec3 = readonly [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** A view matrix (column-major) for an eye looking along `forward`, `up` as near up as it allows. */
export function viewMatrix(eye: Vec3, forward: Vec3, up: Vec3): Float32Array {
  const f = normalize(forward);
  const r = normalize(cross(f, up));
  const u = cross(r, f);
  return new Float32Array([
    r[0],
    u[0],
    -f[0],
    0,
    r[1],
    u[1],
    -f[1],
    0,
    r[2],
    u[2],
    -f[2],
    0,
    -dot(r, eye),
    -dot(u, eye),
    dot(f, eye),
    1,
  ]);
}

/**
 * A perspective projection (column-major) with a vertical field of view in degrees; its far plane
 * may be infinitely far (nothing however far is cut off).
 */
export function projectionMatrix(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const t = 1 / Math.tan((fovY * Math.PI) / 360);
  const infinite = !Number.isFinite(far);
  return new Float32Array([
    t / aspect,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    0,
    0,
    infinite ? -1 : (far + near) / (near - far),
    -1,
    0,
    0,
    infinite ? -2 * near : (2 * far * near) / (near - far),
    0,
  ]);
}

/** A vector turned about an axis (unit) by an angle in radians. */
function turnAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

/**
 * Draws in drawing order: opaque first (they write depth), then the blended ones by the model's
 * priority, highest first, as the game draws a model's materials (the order of equal ones is kept).
 */
/**
 * Draws in the order they are drawn: each owner's (the sky's, each placed planet's) by its
 * materials' draw order (`drawOrder`, with the order `orderOf` gives it, where set); all the opaque
 * first, then the rest by their places in their owners' orders.
 */
function sorted<T extends { readonly draw: MeshDraw; readonly blend: SceneBlend }>(
  draws: readonly T[],
  orderOf: (placed: Placed | undefined) => readonly string[] | undefined,
): T[] {
  const owners = new Map<Placed | undefined, T[]>();
  for (const d of draws) owners.set(d.draw.placed, [...(owners.get(d.draw.placed) ?? []), d]);
  const rank = new Map<T, number>();
  for (const [placed, list] of owners) {
    const names = drawOrder(
      list.map((d) => ({ name: d.draw.key, blend: d.blend, priority: d.draw.material.priority })),
      orderOf(placed),
    );
    for (const d of list) rank.set(d, names.indexOf(d.draw.key));
  }
  return [...draws].sort(
    (a, b) =>
      Number(a.blend !== 'opaque') - Number(b.blend !== 'opaque') || rank.get(a)! - rank.get(b)!,
  );
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

/**
 * One material drawn on one mesh, or on one part of a placed planet's body; moving when one of
 * its layers scrolls.
 */
interface MeshDraw {
  readonly vao: WebGLVertexArrayObject;
  readonly count: number;
  /** The material's name. */
  readonly name: string;
  /** What its settings are kept by (an overlay's material's: by the overlay too; see `materialKey`). */
  readonly key: string;
  /** The overlay it is of, where it is an overlay's (a body's, or the sky's). */
  readonly overlay?: string;
  readonly material: SceneMaterial;
  readonly moving: boolean;
  /** The planet it is part of (a placed one), whose frame places it; none: in world space as it is. */
  readonly placed?: Placed;
  /** The planet or overlay the material is of, whose tuning is its settings' default; none: the sky's. */
  readonly owner?: LoadedPlanet;
  /** The part of the planet's body it is, drawn on the square instead of a mesh. */
  readonly part?: BodyPart;
  /** The exact tube its mesh stands for, where it is one (the sky's star cylinder): drawn as that. */
  readonly tube?: Tube;
  /** That part by whose it is and its role, for its settings. */
  readonly partKey?: PartKey;
  /** How it is lit, where it is a lit material of a flyby planet. */
  readonly light?: PlanetLight;
}

/** A planet put up in the scene: where, how big, and which tint channel is its. */
export interface PlanetPlacement {
  readonly planet: LoadedPlanet;
  /**
   * The overlays it wears, the later over the earlier: their parts about the body, the first's
   * light (of those that have one) on the body's lit materials.
   */
  readonly overlays?: readonly LoadedPlanet[];
  /** Not drawn (nor picked), though where it is: switched off. */
  readonly hidden?: boolean;
  /**
   * Its materials' settings (its own by name, its overlays' by `materialKey`), over the tunings'
   * (the planet's for its materials, an overlay's for its own).
   */
  readonly materials?: MaterialSettingsMap;
  /** The materials' base settings, by name, under its overlays' materials' own. */
  readonly base?: MaterialSettingsMap;
  /** Its parts' shapes and mappings, by part, in place of their own. */
  readonly parts?: PartSettingsMap;
  /** Its materials' draw order, by `materialKey` (its own and its overlays'), where set (see `drawOrder`). */
  readonly order?: readonly string[];
  /** Its lights' settings, by light, over its rig's and its shade (see `scene-lights.ts`). */
  readonly lights?: LightSettingsMap;
  /** Lights added to it (its own and its overlay's), after its rig's. */
  readonly added?: readonly AddedLight[];
  /** A tint over all its materials (its overlays' too), over its tuning's. */
  readonly tint?: MaterialTint;
  /**
   * Its rig turned and made stronger together (`tunedRig`), over its tuning's: kept from before
   * lights were objects (each light's own settings now), no longer set.
   */
  readonly lightFrom?: Vec3;
  /** Where its rims and glows lean (a point on its face), over its tuning's; none: as the data has them. */
  readonly rim?: Vec3;
  /** (See `lightFrom`.) */
  readonly lighting?: number;
  /** A shade from a side, over its overlays'. */
  readonly shade?: Partial<BodyShade>;
  readonly position: Vec3;
  /** Its body's radius in the scene's units. */
  readonly radius: number;
}

/** A placement with its body's frame as last placed. */
interface Placed {
  placement: PlanetPlacement;
  frame: BodyFrame;
  /** The half-side of the square its parts are drawn on, in the scene's units: its widest part. */
  extent: number;
  /** Its draws as drawn, in drawing order. */
  states: DrawState[];
  /** Bumped whenever what it is drawn as changes (its settings, where it is): it is baked again. */
  version: number;
  /** How far its parts reach from its centre, in the scene's units. */
  reachOf: number;
  /** Whether it has a part of another shape than a sphere or a ring (hidden behind bodies' surfaces). */
  hasShapes: boolean;
  /** It drawn on its own, put back into each frame. */
  bake: Bake | null;
}

/** A body's frame: its axes in the world (column-major: x, y, z), and the eye in it, in units of its radius. */
export interface BodyFrame {
  readonly axes: Float32Array;
  readonly eye: Vec3;
}

/**
 * A planet's body's frame, as the game's billboards turn to face the eye: about its centre, y
 * away from the eye, z as near up as it can be, x to the right; and the eye in that frame, in
 * units of the body's radius.
 */
export function bodyFrame(position: Vec3, radius: number, eye: Vec3): BodyFrame {
  const y = normalize([position[0] - eye[0], position[1] - eye[1], position[2] - eye[2]]);
  const up: Vec3 = Math.abs(y[2]) < 0.999 ? [0, 0, 1] : [0, 1, 0]; // straight above or below: any way up
  const lean = dot(up, y);
  const z = normalize([up[0] - lean * y[0], up[1] - lean * y[1], up[2] - lean * y[2]]);
  const x = cross(y, z);
  const to: Vec3 = [eye[0] - position[0], eye[1] - position[1], eye[2] - position[2]];
  return {
    axes: new Float32Array([...x, ...y, ...z]),
    eye: [dot(to, x) / radius, dot(to, y) / radius, dot(to, z) / radius],
  };
}

/** A vector in a body's frame (its axes column-major), from the world. */
function intoFrame(axes: Float32Array, v: Vec3): Vec3 {
  return [
    axes[0]! * v[0] + axes[1]! * v[1] + axes[2]! * v[2],
    axes[3]! * v[0] + axes[4]! * v[1] + axes[5]! * v[2],
    axes[6]! * v[0] + axes[7]! * v[1] + axes[8]! * v[2],
  ];
}

/**
 * How big a flat ring at `depth` (towards the eye, negative) must be to lie on a body's limb seen
 * from `distance` (both in the body's radii), but for a factor: the limb's tangent (1 over the
 * root of distance² - 1) times the ring's distance from the eye. A ring modelled to lie on the
 * limb from one distance keeps to it from another, scaled by the ratio of the two.
 */
const ringFit = (distance: number, depth: number) =>
  Number.isFinite(distance)
    ? (distance + depth) / Math.sqrt(Math.max(distance * distance - 1, 1e-6))
    : 1; // from afar: the limb as far as the ring

/** How much bigger a ring is drawn seen from `distance` (the body's radii) than as modelled. */
const ringScale = (shape: { readonly depth: number; readonly seen?: number }, distance: number) =>
  shape.seen ? ringFit(distance, shape.depth) / ringFit(shape.seen, shape.depth) : 1;

/** A number for each sky overlay's file, to tell a changed one (one made in the editor) apart. */
const fileIds = new WeakMap<object, number>();
let nextFileId = 0;
const fileId = (file: object) => {
  let id = fileIds.get(file);
  if (id === undefined) fileIds.set(file, (id = nextFileId++));
  return id;
};

/** Whether a draw is shown: its body and its part switched on (the sky's always are). */
function shown(draw: MeshDraw): boolean {
  const placement = draw.placed?.placement;
  if (!placement) return true;
  return !placement.hidden && !(draw.partKey && placement.parts?.[draw.partKey]?.enabled === false);
}

/** The overlays a placed planet wears (none: none). */
const overlaysOf = (placement: PlanetPlacement) => placement.overlays ?? [];

/** How a placed planet wears its overlays (its tuning's say for each), merged, the later over the earlier. */
const wearsIn = (placement: PlanetPlacement) =>
  overlaysOf(placement).map((o) => wearOf(placement.planet.planet, overlayOfFile(o.id)));

/** A placed planet's overlay's parts, as it wears them. */
const overlayParts = (placement: PlanetPlacement, overlay: LoadedPlanet): readonly BodyPart[] =>
  wornParts(placement.planet.planet, overlayOfFile(overlay.id), overlay.planet.parts);

/** A placed planet's parts: its body's, and its overlays' as it wears them; each as set. */
function partsOf(placement: PlanetPlacement): readonly BodyPart[] {
  return [
    ...placement.planet.planet.parts.map((p) => withPart(p, placement.parts?.[ownPartKey(p)])),
    ...overlaysOf(placement).flatMap((o) =>
      overlayParts(placement, o).map((p) =>
        withPart(p, placement.parts?.[overlayPartKey(overlayOfFile(o.id), p)]),
      ),
    ),
  ];
}

/**
 * The half-side of the square a body's parts are drawn on, in the scene's units: as far as they
 * reach, widened for perspective. A sphere seen from a finite distance shows wider than its radius
 * on the plane through its centre (its outline is where the eye's rays graze it, nearer the eye):
 * by d/sqrt(d^2 - r^2) for a sphere of radius r at distance d; a square only as wide as the radius
 * cuts its edges off, the more so the nearer and larger the body.
 */
export function bodyExtent(radius: number, reachOf: number, eyeDistance: number): number {
  const r = radius * reachOf;
  const d = Math.max(eyeDistance, r * 1.01); // the eye inside it: as wide as it can usefully be
  return (r * d) / Math.sqrt(d * d - r * r);
}

/**
 * The half-side of the square a body's parts are drawn on (see `bodyExtent`), from all of them:
 * its spheres widened for perspective, and its rings (flat, facing the eye, `depth` from its
 * centre: one nearer the eye shows wider on the square, by d over its plane's distance), sized
 * as seen from there.
 */
export function partsExtent(
  radius: number,
  parts: readonly BodyPart[],
  eyeDistance: number,
): number {
  const d = eyeDistance / radius;
  let out = bodyExtent(radius, reach(parts.filter((p) => p.shape.kind !== 'ring')), eyeDistance);
  for (const { shape } of parts) {
    if (shape.kind !== 'ring') continue;
    const plane = d + shape.depth;
    if (plane > 0) out = Math.max(out, (radius * shape.outer * ringScale(shape, d) * d) / plane);
  }
  return out;
}

/** How far a body's parts reach from its centre, in its radii (its shells, rings, offset moons): at least 1. */
export function reach(parts: readonly BodyPart[], distance?: number): number {
  return Math.max(
    1,
    ...parts.map((p) =>
      p.shape.kind === 'ring'
        ? p.shape.outer * (distance ? ringScale(p.shape, distance) : 1)
        : shapeReach(p.shape),
    ),
  );
}

/** A float render target (half floats where the browser can render to them), with depth. */
interface Target {
  readonly framebuffer: WebGLFramebuffer;
  /** Its depth, as a texture (a beam is hidden where the frame's is nearer). */
  depth: WebGLTexture | null;
  texture: WebGLTexture | null;
  /** Its glow, drawn in a pass of its own (see `OUTPUTS`), with a depth of its own. */
  readonly glowFramebuffer: WebGLFramebuffer;
  glow: WebGLTexture | null;
  glowDepth: WebGLTexture | null;
}

const moves = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, m.specular, ...m.alphaMasks].some((layer) => layer?.scroll);

interface ParticleDraw {
  /** Its material's name (the sky's settings for it apply). */
  readonly name: string;
  readonly system: ParticleSystem;
  readonly vao: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  readonly material: SceneMaterial;
}

/**
 * A draw as it is drawn: worked out once from its material, its settings and its body (when one
 * of them changes, not each frame), its uniforms then given to GL as they are.
 */
interface DrawState {
  readonly draw: MeshDraw;
  /** Whether it is drawn at all: switched on, its body and its part shown. */
  readonly enabled: boolean;
  readonly depth: MaterialDepth;
  readonly blend: SceneBlend;
  readonly moving: boolean;
  /** Its material as set (its masks, its layers' textures and transforms, lit or flat). */
  readonly material: SceneMaterial;
  /** Its uniforms but for where it is seen from and the time (a scrolling layer's offset). */
  readonly uniforms: UniformSet;
  /** Its layers that scroll, by slot. */
  readonly scrolls: readonly { readonly slot: number; readonly layer: SceneLayer }[];
  /** Each slot's texture and sampler. */
  readonly textures: readonly (WebGLTexture | null)[];
  readonly samplers: readonly (WebGLSampler | null)[];
  /** A body's part as set: its shape, its mappings. */
  readonly part?: BodyPart;
  /** What it was worked out from (the sky's draws: whether they have to be drawn again). */
  readonly signature: string;
  /** Its uniforms as each program takes them, found once. */
  readonly blocks: Map<WebGLProgram, UniformBlock>;
}

/**
 * A body drawn on its own (baked), into a target the size of the pixels it covers: put back into
 * each frame as it is, until it changes (or the view does, or its layers scroll a pixel on).
 */
interface Bake {
  readonly framebuffer: WebGLFramebuffer;
  color: WebGLTexture | null;
  depth: WebGLTexture | null;
  /** Its glow, drawn in a pass of its own (see `OUTPUTS`), with a depth of its own. */
  readonly glowFramebuffer: WebGLFramebuffer;
  glow: WebGLTexture | null;
  glowDepth: WebGLTexture | null;
  /** Its textures' size. */
  width: number;
  height: number;
  /** The frame's pixels it covers (none: none of it shows). */
  rect: PixelRect | null;
  /** What it was baked for (the view, the body, the surfaces in front of its shapes). */
  key: string;
  /** The time it was baked at, on the scene's clock. */
  at: number;
  /** Whether its program was ready (else it is baked again, next frame). */
  complete: boolean;
  /** How many pixels a second its scrolling layers move across it (0: none scroll). */
  scroll: number;
}

/**
 * Draws the scene into a canvas with WebGL 2: the sky's meshes through the game's camera, the
 * placed planets' bodies each on camera-facing squares (their parts' shapes found under each
 * pixel: no mesh), then the particles as camera-facing squares, into a half-float target (light
 * adds up past white, as in the game's HDR), tone-mapped onto the canvas. Opaque materials draw
 * first and hide what is behind them; the blended ones follow by priority.
 *
 * What is drawn is worked out once and kept (`DrawState`): each draw's settings, material, light
 * and uniforms, made again only when what they come from changes (a body's placement, the sky's
 * settings, the scene's lights). What doesn't move is drawn once and kept too: the sky's (the
 * nebula and stars) in targets of its own, colour and depth, each frame starting from a copy of
 * them; each body on its own (`Bake`), put back into each frame pixel for pixel, baked again only
 * when it changes, the view does, or its scrolling layers have moved half a pixel. A frame is only
 * worth drawing when something has changed or moves (`needsFrame`). Each target also keeps what
 * glows beyond the scene's own bloom. Each material is drawn as its settings say (the sky's as set
 * by `setSky`; a planet's as its placement, its tuning and its style's say): not at all, fainter,
 * blended another way, glowing more or less, its pattern sized. The bodies are drawn with one
 * program any part can be drawn with (its shape and what it is drawn with chosen as it runs),
 * compiled in the background where the browser can. Only the one: with Direct3D (ANGLE), a
 * program's first draw into two targets compiles it again, uncached, holding the whole browser up
 * for a second or more, so each program more (a variant per part) would hold it up again; and the
 * context keeps them for the next scene (`programsOf`).
 */
export class SceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  /** The bodies' and the meshes' programs (compiled in the background where the browser can: none until done). */
  private readonly programs: Programs;
  /** The square a body's parts are drawn on. */
  private readonly quad: WebGLVertexArrayObject;
  private readonly particleProgram: WebGLProgram;
  private readonly toneProgram: WebGLProgram;
  private readonly bloomProgram: WebGLProgram;
  private readonly compositeProgram: WebGLProgram;
  private readonly impostorProgram: WebGLProgram;
  private readonly beamProgram: WebGLProgram;
  private readonly outlineProgram: WebGLProgram;
  /** A beam's tube, put where each beam is when drawn. */
  private readonly beamVao: WebGLVertexArrayObject;
  private readonly beamCount: number;
  /** The beams and outlines shown over the picture (an editor's: the light selected). */
  private beams: readonly LightAid[] = [];
  /** The bloom's two small targets, blurred from one into the other and back. */
  private readonly bloom: { framebuffer: WebGLFramebuffer; texture: WebGLTexture | null }[];
  private bloomSize: [number, number] = [1, 1];
  private readonly textures = new Map<string, WebGLTexture>();
  /** How layers sample their textures, by whether they repeat across u (1) and across v (2). */
  private readonly samplers: WebGLSampler[];
  private readonly vaos: WebGLVertexArrayObject[] = [];
  /** The scene's own draws (its sky), then its sky's overlays'. */
  private readonly sceneDraws: MeshDraw[] = [];
  private skyOverlayDraws: MeshDraw[] = [];
  /** The sky's draws as drawn, in drawing order; and what they were worked out from. */
  private skyStates: DrawState[] = [];
  private skySignature = '';
  /** Whether any of the sky's draws moves, and any of its particles shows (frames are drawn then). */
  private skyMoves = false;
  private particlesShown = false;
  /** The sky's overlays' meshes on the GPU, and what they were made for (rebuilt when it changes). */
  private skyOverlayVaos: WebGLVertexArrayObject[] = [];
  private skyOverlayKey = '';
  /** The placed planets whose textures are on the GPU; kept while the renderer lives. */
  private readonly planetsOnGpu = new WeakSet<LoadedPlanet>();
  private placed: Placed[] = [];
  private readonly particles: ParticleDraw[] = [];
  private readonly uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  /** The targets' format: half floats where the browser can render to them, else bytes. */
  private readonly format: number;
  /**
   * What doesn't move of the sky, drawn once per size: the background (behind every object), and
   * what is among the objects on its own (premultiplied, over nothing) for what moves behind it to
   * go under.
   */
  private readonly stillBackground: Target;
  private readonly stillScene: Target;
  /** The frame before tone mapping. */
  private readonly frame: Target;
  /**
   * What doesn't move of the sky, small (SKY_LIGHT_SIZE square, with its mipmaps: blurred as
   * read), for the environment lights: drawn again with the still sky; bodies are baked again
   * when it is (`skyVersion`).
   */
  private readonly skyLight: { framebuffer: WebGLFramebuffer; texture: WebGLTexture };
  private skyVersion = 0;
  private view: Float32Array = new Float32Array(16);
  private projection: Float32Array = new Float32Array(16);
  /** The camera turned from where the scene puts it, about its up, in radians. */
  private yaw = 0;
  /** Whether what doesn't move of the sky has to be drawn again before the next frame. */
  private stillDirty = true;
  /** Whether anything has changed since the last frame (a frame is worth drawing). */
  private changed = true;
  /** Bumped whenever the view changes (where the camera is or looks, the canvas's size): bodies are baked again. */
  private viewVersion = 0;
  /** The bodies' surfaces (spheres in the world) shapes are hidden behind, and what they are, as a key. */
  private surfaces: number[][] = [];
  private surfacesKey = '';
  /** Times the GPU takes, where it can be timed. */
  private readonly timer: GpuTimer;
  /** Whether the GPU's time is measured (frame stats shown). */
  timing = false;

  /** Throws when the browser has no WebGL 2. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly loaded: LoadedPlayScene,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL 2 is not available');
    this.gl = gl;
    this.programs = programsOf(gl);
    this.programs.request(BODY, BODY_VERTEX, bodyFragment());
    this.programs.request(MESH, MESH_VERTEX, meshFragment(true));
    this.quad = this.quadVao();
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.toneProgram = program(gl, TONE_VERTEX, TONE_FRAGMENT);
    this.bloomProgram = program(gl, TONE_VERTEX, BLOOM_FRAGMENT);
    this.compositeProgram = program(gl, TONE_VERTEX, COMPOSITE_FRAGMENT);
    this.impostorProgram = program(gl, IMPOSTOR_VERTEX, IMPOSTOR_FRAGMENT);
    this.beamProgram = program(gl, BEAM_VERTEX, BEAM_FRAGMENT);
    this.outlineProgram = program(gl, OUTLINE_VERTEX, OUTLINE_FRAGMENT);
    this.timer = new GpuTimer(gl);
    const tube = beamTube();
    this.beamCount = tube.length / 3;
    this.beamVao = this.tubeVao(tube);
    this.bloom = [0, 1].map(() => ({ framebuffer: gl.createFramebuffer(), texture: null }));
    this.samplers = [0, 1, 2, 3].map((wrap) => {
      const s = gl.createSampler();
      gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, wrap & 1 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, wrap & 2 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      return s;
    });
    this.format = gl.getExtension('EXT_color_buffer_float') !== null ? gl.RGBA16F : gl.RGBA8;
    const target = (): Target => ({
      framebuffer: gl.createFramebuffer(),
      depth: null,
      texture: null,
      glowFramebuffer: gl.createFramebuffer(),
      glow: null,
      glowDepth: null,
    });
    this.stillBackground = target();
    this.stillScene = target();
    this.frame = target();
    this.skyLight = this.skyLightTarget();
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const [key, image] of Object.entries(loaded.images))
      this.textures.set(key, this.texture(image));
    const { scene } = loaded;
    for (const [name, mesh] of Object.entries(scene.meshes)) {
      if (!mesh.materials.length) continue; // an emitter, not drawn
      if (mesh.planet) continue; // the scene's own planets: put up as placed planets instead
      const tube = fitTube(mesh);
      // A tube is drawn on a cover that reaches round and past it (its own mesh's corners cut
      // its round ends to their sides).
      const drawn = tube ? tubeCover(tube) : mesh;
      const vao = this.meshVao(drawn);
      this.vaos.push(vao);
      for (const m of mesh.materials) {
        const material = this.material(m, name, scene.materials);
        this.sceneDraws.push({
          vao,
          count: drawn.indices.length,
          name: m,
          key: m,
          material,
          moving: moves(material),
          ...(tube ? { tube } : {}),
        });
      }
    }
    for (const system of scene.particles) {
      const emitter = scene.meshes[system.emitter];
      if (!emitter) throw new Error(`the particles' emitter ${system.emitter} isn't in the scene`);
      const particles = new ParticleSystem(system, emitter);
      const [vao, buffer] = this.particleVao(particles);
      this.particles.push({
        name: system.material,
        system: particles,
        vao,
        buffer,
        material: this.material(system.material, 'particles', scene.materials),
      });
    }
    this.placeSkyOverlays(); // the overlays its data says it wears, until told otherwise
    this.resolveSky();
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LEQUAL);
  }

  /**
   * The planets put up in the scene, replacing those there were: their textures go to the GPU the
   * first time each planet is placed. A body put up as it was (the same placement) keeps what is
   * worked out and baked of it; only the others are worked out again.
   */
  setPlanets(placements: readonly PlanetPlacement[]): void {
    const { eye } = this.camera;
    let uploaded = false;
    for (const placement of placements)
      for (const loaded of [placement.planet, ...overlaysOf(placement)]) {
        if (this.planetsOnGpu.has(loaded)) continue;
        for (const [textureKey, image] of Object.entries(loaded.images))
          if (!this.textures.has(textureKey)) {
            this.textures.set(textureKey, this.texture(image));
            uploaded = true;
          }
        this.planetsOnGpu.add(loaded);
      }
    // New textures: what reads one (a layer set to another planet's texture) is worked out again.
    if (uploaded) this.resolveSky();
    const before = new Map(this.placed.map((p) => [p.placement, p]));
    this.placed = placements.map((placement) => {
      const kept = before.get(placement);
      before.delete(placement);
      if (kept && !uploaded) return kept;
      const placed: Placed = {
        placement,
        frame: bodyFrame(placement.position, placement.radius, eye),
        extent: 0,
        states: [],
        // Its version goes on from the one before (its bake, kept, is then made again).
        version: kept?.version ?? 0,
        reachOf: 0,
        hasShapes: false,
        bake: kept?.bake ?? null,
      };
      this.measure(placed);
      this.resolveBody(placed);
      return placed;
    });
    for (const gone of before.values()) this.freeBake(gone.bake);
    this.updateSurfaces();
    this.changed = true;
  }

  /** A body's square and reach as placed now, seen from the eye. */
  private measure(placed: Placed): void {
    const { position, radius } = placed.placement;
    const parts = partsOf(placed.placement);
    placed.extent = partsExtent(radius, parts, distance(position, this.camera.eye));
    placed.reachOf = reach(parts) * radius;
    placed.hasShapes = parts.some((p) => p.shape.kind !== 'sphere' && p.shape.kind !== 'ring');
  }

  /** A body's draws made and worked out (its parts', and its overlays' as it wears them), in drawing order. */
  private resolveBody(placed: Placed): void {
    const { planet } = placed.placement;
    const overlays = overlaysOf(placed.placement);
    // The body's own parts lit by its overlays' light where one has one, then the overlays' parts.
    const light = overlays.find((o) => o.planet.light)?.planet.light ?? planet.planet.light;
    const draws: MeshDraw[] = [];
    for (const loaded of [planet, ...overlays]) {
      const own = loaded === planet;
      const parts = own ? loaded.planet.parts : overlayParts(placed.placement, loaded);
      parts.forEach((part, i) => {
        for (const m of part.materials) {
          const material = this.material(m, `${loaded.id}/${i}`, loaded.planet.materials);
          const overlay = own ? undefined : overlayOfFile(loaded.id);
          draws.push({
            vao: this.quad,
            count: 4,
            name: m,
            key: materialKey(m, overlay),
            ...(overlay ? { overlay } : {}),
            material,
            moving: moves(material),
            placed,
            owner: loaded,
            part,
            partKey: own ? ownPartKey(part) : overlayPartKey(overlayOfFile(loaded.id), part),
            light,
          });
        }
      });
    }
    placed.states = sorted(
      draws.map((d) => this.resolve(d)),
      () => placed.placement.order,
    );
    placed.version++;
  }

  /** The sky's draws worked out again; what doesn't move of it drawn again where any has changed. */
  private resolveSky(): void {
    const states = [...this.sceneDraws, ...this.skyOverlayDraws].map((d) => this.resolve(d));
    this.skyStates = sorted(states, () => this.sky.order);
    this.skyMoves = this.skyStates.some((s) => s.enabled && s.moving);
    this.particlesShown = this.particles.some(
      (p) => this.sky.materials?.[p.name]?.enabled ?? MATERIAL_DEFAULTS.enabled,
    );
    const signature = JSON.stringify([
      this.skyStates.map((s) => s.signature),
      this.sky.tint ?? null,
      this.textures.size,
    ]);
    if (signature !== this.skySignature) {
      this.skySignature = signature;
      this.stillDirty = true;
    }
    this.changed = true;
  }

  /** A draw worked out: its settings, its material as set, how it is lit, its uniforms. */
  private resolve(draw: MeshDraw): DrawState {
    const settings = this.settingsOf(draw);
    const has = (texture: string) => this.textures.has(texture);
    // A material as set: its masks and its layers' textures and transforms (a scroll set makes
    // it move).
    const layered = withLayers(withMasks(draw.material, settings?.masks), settings?.layers, has);
    const placement = draw.placed?.placement;
    // Lit or flat as set (else as the data has it); lit with no light to light it: flat.
    const unshaded =
      !!draw.part &&
      ((settings?.lit !== undefined ? !settings.lit : layered.unshaded) ||
        (!draw.light && !addedLighting(this.addedTo(placement), placement?.lights)));
    const material =
      draw.part && unshaded !== layered.unshaded ? { ...layered, unshaded } : layered;
    const moving = draw.moving || (material !== draw.material && moves(material));
    const blend = settings?.blend ?? draw.material.blend;
    const enabled = (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) && shown(draw);
    const depth = this.depthOf(draw.name, settings, !!draw.placed);
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
    const textures = layersOf(material).map((layer) =>
      layer?.texture ? (this.textures.get(layer.texture) ?? null) : null,
    );
    const samplers = layersOf(material).map((layer, i) => {
      if (!textures[i] || !layer) return null;
      const [wu, wv] = layer.wrap ?? [true, true];
      return this.samplers[(wu ? 1 : 0) | (wv ? 2 : 0)]!;
    });
    const base = {
      draw,
      enabled,
      depth,
      blend,
      moving,
      material,
      uniforms: u,
      scrolls: scrollingLayers(material),
      textures,
      samplers,
      blocks: new Map<WebGLProgram, UniformBlock>(),
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
        signature: JSON.stringify([draw.key, settings ?? null, blend, depth, enabled]),
      };
    }
    const part = withPart(draw.part, draw.partKey && placement.parts?.[draw.partKey]);
    partUniforms(u, part);
    const tuning = placement.planet.planet.tuning;
    const rig = material.unshaded ? undefined : draw.light;
    const turned =
      rig &&
      tunedRig(
        rig,
        placement.lighting ?? tuning?.lighting,
        placement.lightFrom ?? tuning?.lightFrom,
      );
    // Its rig as set, and the lights added to it (its own, its overlay's, its scene's), each
    // only where it reaches this part and material (its linking).
    const added = this.addedTo(placement);
    const linked = linkedSettings(placement.lights, added, draw.partKey, draw.key);
    const shade = this.shadeOf(placement);
    const exposure = this.loaded.scene.tone.exposure;
    const light = material.unshaded
      ? undefined
      : withAddedLights(
          turned && withLightSettings(turned, linked),
          added,
          linked,
          exposure,
          shade,
        );
    lightUniforms(u, light, exposure);
    const shine = materialValues(material, settings);
    u.f1('uSpecularMult', shine.specular);
    u.f1('uSpecularity', shine.glossiness);
    tintUniforms(u, 'uBodyTint', placement.tint ?? tuning?.tint);
    const rim = placement.rim ?? tuning?.rim;
    u.v2('uRimTurn', rim ? rimTurn(rim) : [0, 0]);
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
    // A grid: shown where its reveal reaches, and coloured by its activation (its material's).
    const grid = draw.part.pattern?.kind === 'hex';
    if (grid) {
      const { reveal, activation } = gridFields(materialValues(material, settings));
      gridUniforms(u, reveal, activation, settings?.inactive, settings?.active ?? DEFAULT_ACTIVE);
    }
    // The body glows under its own light's bloom threshold, lit or not (its city lights aren't lit).
    const worn = overlaysOf(placement);
    const own = worn.length
      ? worn.find((o) => o.planet.light)?.planet.light
      : placement.planet.planet.light;
    u.f1('uGlowThreshold', own?.bloomThreshold ?? this.sceneThreshold());
    // A drawn pattern (unless shown as its texture, as the game does): as many cells round
    // the part as its texture has (or HEX_ROUND), over its scale; its lines' width and glow.
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
    return { ...base, part, signature: '' };
  }

  /**
   * Where each placed planet is on the canvas, as it was last placed: its centre, and the top of
   * its body, as shares of the canvas's width and height from its top left; none for one behind
   * the camera.
   */
  /**
   * The placed planet under a point of the view (`x`, `y`: shares of its width and height; the
   * view `aspect` wide), by its index in what was put up (`setPlanets`); the nearest where they
   * overlap; null where there is none. Its body counts, not its halo.
   */
  pick(x: number, y: number, aspect: number): number | null {
    const viewProjection = multiply(this.projection, this.view);
    const m = viewProjection;
    const project = (p: Vec3): [number, number, number] | null => {
      const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
      if (w <= 0) return null;
      const px = (m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!) / w;
      const py = (m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!) / w;
      return [(px + 1) / 2, (1 - py) / 2, w];
    };
    let best: { index: number; depth: number } | null = null;
    this.placed.forEach(({ placement }, index) => {
      if (placement.hidden) return;
      const { position, radius } = placement;
      const centre = project(position);
      const top = project([position[0], position[1], position[2] + radius]);
      if (!centre || !top) return;
      const r = Math.abs(centre[1] - top[1]);
      const hit = Math.hypot((x - centre[0]) * aspect, y - centre[1]) <= r;
      if (hit && (!best || centre[2] < best.depth)) best = { index, depth: centre[2] };
    });
    return (best as { index: number } | null)?.index ?? null;
  }

  anchors(): { id: string; x: number; y: number; top: number }[] {
    const viewProjection = multiply(this.projection, this.view);
    const project = (p: Vec3): [number, number] | null => {
      const m = viewProjection;
      const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
      if (w <= 0) return null;
      const x = (m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!) / w;
      const y = (m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!) / w;
      return [(x + 1) / 2, (1 - y) / 2];
    };
    const out: { id: string; x: number; y: number; top: number }[] = [];
    for (const { placement } of this.placed) {
      const { position, radius } = placement;
      const centre = project(position);
      const top = project([position[0], position[1], position[2] + radius]);
      if (centre && top)
        out.push({
          id: placement.planet.label ?? placement.planet.id,
          x: centre[0],
          y: centre[1],
          top: top[1],
        });
    }
    return out;
  }

  /** The placed planets moved: their positions and radii, in the order they were placed. */
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void {
    const { eye } = this.camera;
    this.placed.forEach((placed, i) => {
      const position = positions[i] ?? placed.placement.position;
      const radius = radii?.[i] ?? placed.placement.radius;
      const was = placed.placement;
      if (position === was.position && radius === was.radius && eye === this.placedFrom) return;
      placed.placement = { ...was, position, radius };
      placed.frame = bodyFrame(position, radius, eye);
      this.measure(placed);
      placed.version++;
    });
    this.placedFrom = eye;
    this.updateSurfaces();
    this.changed = true;
  }

  /** The eye the bodies were last placed from. */
  private placedFrom?: Vec3;

  /** Where a scene puts the camera, over the game's (what it sets of it). */
  private cameraSet: SceneCameraSet = {};

  /** The camera: the game's, as a scene puts it (where it is, where it looks, its field of view). */
  private get camera(): SceneCamera {
    return { ...this.loaded.scene.camera, ...this.cameraSet };
  }

  /**
   * The camera put where a scene says (none set: the game's): everything seen from there (the
   * planets' faces turned to it, the sky's overlays placed about it), drawn again.
   */
  setCamera(set: SceneCameraSet | undefined): void {
    const next = set ?? {};
    if (JSON.stringify(next) === JSON.stringify(this.cameraSet)) return;
    this.cameraSet = next;
    this.view = this.viewNow();
    this.projection = this.projectionNow();
    this.placedFrom = undefined;
    this.placePlanets(this.placed.map((p) => p.placement.position));
    this.placeSkyOverlays();
    this.resolveSky();
    this.stillDirty = true;
    this.viewChanged();
  }

  /** The camera turned about its up from where the scene puts it, in radians. */
  setYaw(yaw: number): void {
    if (yaw === this.yaw) return;
    this.yaw = yaw;
    this.view = this.viewNow();
    this.stillDirty = true;
    this.viewChanged();
  }

  /** The view changed: every body is baked again, and the frame drawn. */
  private viewChanged(): void {
    this.viewVersion++;
    this.changed = true;
  }

  private projectionNow(): Float32Array {
    const camera = this.camera;
    return projectionMatrix(
      camera.fovY,
      this.canvas.width / this.canvas.height,
      camera.near,
      Infinity, // the scene's objects however far they are set (the sky is drawn behind them anyway)
    );
  }

  private viewNow(): Float32Array {
    const camera = this.camera;
    const forward = turnAbout(camera.forward, camera.up, this.yaw);
    return viewMatrix(camera.eye, forward, camera.up);
  }

  /**
   * The drawing buffer's size, in device pixels; the camera keeps its vertical field of view. What
   * doesn't move is drawn again at the new size.
   */
  resize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.view = this.viewNow();
    this.projection = this.projectionNow();
    this.allocate(this.stillBackground);
    this.allocate(this.stillScene);
    this.allocate(this.frame);
    this.allocateBloom();
    this.stillDirty = true;
    this.viewChanged();
  }

  /** The bloom's targets, a quarter of the canvas each way. */
  private allocateBloom(): void {
    const gl = this.gl;
    this.bloomSize = [
      Math.max(1, Math.ceil(this.canvas.width / BLOOM_SCALE)),
      Math.max(1, Math.ceil(this.canvas.height / BLOOM_SCALE)),
    ];
    for (const target of this.bloom) {
      gl.deleteTexture(target.texture);
      target.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, this.format, this.bloomSize[0], this.bloomSize[1]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        target.texture,
        0,
      );
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    }
  }

  /** The bloom of the frame, into the first bloom target. */
  private drawBloom(): void {
    const gl = this.gl;
    const p = this.bloomProgram;
    const [w, h] = this.bloomSize;
    gl.useProgram(p);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindSampler(0, null);
    gl.uniform1i(this.uniform(p, 'uSource'), 0);
    gl.uniform1f(this.uniform(p, 'uThreshold'), this.sceneThreshold());
    // The bright part, from the frame, and the planets' own glow.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloom[0]!.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindSampler(1, null);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.glow);
    gl.uniform1i(this.uniform(p, 'uGlow'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uniform(p, 'uPass'), 0);
    gl.uniform2f(this.uniform(p, 'uStep'), 1 / this.canvas.width, 1 / this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Blurred across and down, BLOOM_PASSES times: from one target into the other and back.
    gl.uniform1i(this.uniform(p, 'uPass'), 1);
    for (let i = 0; i < BLOOM_PASSES * 2; i++) {
      const from = this.bloom[i % 2]!;
      const into = this.bloom[(i + 1) % 2]!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, into.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
      gl.uniform2f(
        this.uniform(p, 'uStep'),
        i % 2 === 0 ? BLOOM_SPACING / w : 0,
        i % 2 === 0 ? 0 : BLOOM_SPACING / h,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  /** What the scene's light blooms: what is brighter than this. */
  private sceneThreshold(): number {
    return this.loaded.scene.tone.bloomThreshold ?? DEFAULT_BLOOM_THRESHOLD;
  }

  /** What doesn't move of the sky, drawn into its targets: the background's, and what is among the objects over nothing. */
  private drawStill(): void {
    // Behind a backdrop the alpha keeps what the scene covers (none yet).
    this.begin(this.stillBackground, this.backdrop ? 0 : 1);
    this.begin(this.stillScene, 0);
    for (const output of OUTPUTS) {
      this.bind(this.stillBackground, output);
      this.drawMeshes(0, 'background', output, false);
      this.bind(this.stillScene, output);
      this.drawMeshes(0, 'scene', output, false);
    }
    this.drawSkyLight();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.stillDirty = false;
  }

  /** The sky light's small target and texture, with room for its mipmaps. */
  private skyLightTarget(): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, SKY_LIGHT_LEVELS, gl.RGBA8, SKY_LIGHT_SIZE, SKY_LIGHT_SIZE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { framebuffer, texture };
  }

  /** The still sky (its background, its scene over it) into the sky light's texture, and its mipmaps. */
  private drawSkyLight(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.skyLight.framebuffer);
    gl.viewport(0, 0, SKY_LIGHT_SIZE, SKY_LIGHT_SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.composite(this.stillBackground, 'colour');
    this.composite(this.stillScene, 'colour');
    gl.bindTexture(gl.TEXTURE_2D, this.skyLight.texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.skyVersion++;
  }

  /** A target's colour (or its glow) over the bound one, as far as its alpha covers. */
  private composite(target: Target, output: Output): void {
    const gl = this.gl;
    const p = this.compositeProgram;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindSampler(0, null);
    gl.bindTexture(gl.TEXTURE_2D, output === 'glow' ? target.glow : target.texture);
    gl.uniform1i(this.uniform(p, 'uColor'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * One target's picture (its colour or its glow, as `output` says), or that picture's depth, into
   * another as it is; the other's bound after.
   */
  private copy(from: Target, into: Target, what: 'picture' | 'depth', output: Output): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebufferOf(from, output));
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebufferOf(into, output));
    const what_ = what === 'depth' ? gl.DEPTH_BUFFER_BIT : gl.COLOR_BUFFER_BIT;
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, what_, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    this.bind(into, output);
  }

  private framebufferOf(target: Target | Bake, output: Output): WebGLFramebuffer {
    return output === 'glow' ? target.glowFramebuffer : target.framebuffer;
  }

  /** A target's (or a bake's) framebuffer for an output bound to draw into. */
  private bind(target: Target | Bake, output: Output): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebufferOf(target, output));
  }

  /** The particles drawn at this depth: they add light, hidden behind what is opaque in the scene. */
  private drawParticles(seconds: number, depth: MaterialDepth): void {
    const gl = this.gl;
    const particles = (this.backdrop ? [] : this.particles).filter(
      (p) => this.depthOf(p.name, this.sky.materials?.[p.name], false) === depth,
    );
    if (!particles.length) return;
    this.depthTest(depth);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(this.particleProgram);
    gl.bindSampler(0, null); // the particles' textures sample as they are set
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uView'), false, this.view);
    gl.uniformMatrix4fv(this.uniform(this.particleProgram, 'uProjection'), false, this.projection);
    gl.uniform1f(this.uniform(this.particleProgram, 'uStreak'), this.streak);
    this.bindTint(this.particleProgram, 'uBodyTint', this.sky.tint);
    for (const p of particles) {
      p.system.update(seconds);
      // The sky's settings for its material: drawn or not, and how strongly.
      const settings = this.sky.materials?.[p.name];
      if (!(settings?.enabled ?? MATERIAL_DEFAULTS.enabled)) continue;
      const layer = p.material.diffuse!;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textures.get(layer.texture!)!);
      gl.uniform1i(this.uniform(this.particleProgram, 'uTexture'), 0);
      gl.uniform1i(
        this.uniform(this.particleProgram, 'uChannel'),
        CHANNELS[layer.channel ?? 'rgb'],
      );
      gl.uniform1f(
        this.uniform(this.particleProgram, 'uBright'),
        layerBrightness(layer.brightMult) * (settings?.strength ?? MATERIAL_DEFAULTS.strength),
      );
      gl.bindVertexArray(p.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, p.system.instances, 0, p.system.count * INSTANCE_FLOATS);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, p.system.count);
    }
    gl.bindVertexArray(null);
  }

  /**
   * Where a material is drawn among the scene's objects: a placed planet's among them, the sky's
   * as set, else where the game data puts it (see `skyDepths`).
   */
  private depthOf(
    name: string,
    settings: MaterialSettings | undefined,
    placed: boolean,
  ): MaterialDepth {
    if (placed) return 'scene';
    return settings?.depth ?? skyDepths(this.loaded.scene)[name] ?? 'background';
  }

  /** The depth test as a depth says: only the scene's objects are tested (the rest are drawn over). */
  private depthTest(depth: MaterialDepth): void {
    if (depth === 'scene') this.gl.enable(this.gl.DEPTH_TEST);
    else this.gl.disable(this.gl.DEPTH_TEST);
  }

  /** How far the stars are streaked across the view, 0 to 1 (0: not at all). */
  streak = 0;
  /** How far the sky's layers are smeared across, as a share of the way round the sky (0: not at all). */
  smear = 0;
  /** The tint drawn over the whole picture. */
  tint: Tint = NO_TINT;
  /** The tint the picture fades from, and how far it is from it to `tint` (1: all the way). */
  fadingFrom: Tint = NO_TINT;
  fade = 1;
  /** How the sky shows: its materials' settings by name, and its tint. */
  private sky: SkySettings = {};
  /** An editing backdrop in place of the sky, if any. */
  private backdrop: Backdrop | null = null;

  /** An editing backdrop shown in place of the sky (null: the sky again). */
  setBackdrop(backdrop: Backdrop | null): void {
    if (JSON.stringify(backdrop) === JSON.stringify(this.backdrop)) return;
    this.backdrop = backdrop;
    this.stillDirty = true;
    this.changed = true;
  }

  /** The scene's lights: added to every planet's (see `scene-lights.ts`). */
  private sceneLights: readonly AddedLight[] = [];

  /** The scene's lights, lighting every planet as its own added ones do: each body worked out again. */
  setSceneLights(lights: readonly AddedLight[]): void {
    if (JSON.stringify(lights) === JSON.stringify(this.sceneLights)) return;
    this.sceneLights = lights;
    for (const placed of this.placed) this.resolveBody(placed);
    this.changed = true;
  }

  /** The lights added to a placed planet: its own and its overlay's, then the scene's. */
  private addedTo(placement: PlanetPlacement | undefined): readonly AddedLight[] {
    if (!placement) return [];
    return placement.added?.length ? [...placement.added, ...this.sceneLights] : this.sceneLights;
  }

  /**
   * The sky shown as these settings say (materials not named, as the data has them), wearing the
   * overlays they say (none given: its data's), each part placed as its settings say.
   */
  setSky(settings: SkySettings): void {
    this.sky = settings;
    this.placeSkyOverlays();
    this.resolveSky();
  }

  /**
   * The sky's overlays' draws as its settings say: each worn overlay's parts (the data's, or one
   * made in the editor's, its textures to the GPU the first time), placed about the eye; made
   * again only when what they are made of changes.
   */
  private placeSkyOverlays(): void {
    const scene = this.loaded.scene;
    const worn: {
      id: string;
      file: SkyOverlayFile;
      images?: Readonly<Record<string, ImageBitmap>>;
    }[] = [
      // Its own parts (added onto it), then the overlays it wears.
      ...(this.sky.own ? [{ id: '', ...this.sky.own }] : []),
      ...(this.sky.overlays ?? scene.wears ?? []).flatMap((id) => {
        const made = this.sky.made?.[id];
        const file = made?.file ?? scene.overlays?.[id];
        return file ? [{ id, file, images: made?.images }] : [];
      }),
    ];
    const key = JSON.stringify([
      worn.map(({ id, file }) => [id, fileId(file)]),
      this.sky.parts ?? null,
      // Placed about the eye: placed again where it moves.
      this.cameraSet,
    ]);
    if (key === this.skyOverlayKey) return;
    this.skyOverlayKey = key;
    const gl = this.gl;
    for (const vao of this.skyOverlayVaos) gl.deleteVertexArray(vao);
    this.skyOverlayVaos = [];
    this.skyOverlayDraws = [];
    for (const { images } of worn)
      for (const [textureKey, image] of Object.entries(images ?? {}))
        if (!this.textures.has(textureKey)) this.textures.set(textureKey, this.texture(image));
    const files = new Map(worn.map((w) => [w.id, w.file]));
    for (const part of skyOverlayParts(worn, this.sky.parts, this.camera)) {
      const file = files.get(overlayOfPartKey(part.key) ?? '');
      if (!file) continue;
      const vao = this.meshVao({ ...part.mesh, materials: part.materials });
      this.skyOverlayVaos.push(vao);
      for (const m of part.materials) {
        if (!file.materials[m]) continue;
        const material = this.material(m, part.key, file.materials);
        const overlay = overlayOfPartKey(part.key);
        this.skyOverlayDraws.push({
          vao,
          count: part.mesh.indices.length,
          name: m,
          key: materialKey(m, overlay),
          ...(overlay ? { overlay } : {}),
          material,
          moving: moves(material),
        });
      }
    }
  }

  /**
   * Whether a frame drawn at `seconds` would differ from the last: something has changed, the
   * bodies' program is still compiling, the sky moves (its scrolling layers, its particles), or a
   * body's scrolling layers have moved far enough to bake it again.
   */
  needsFrame(seconds: number): boolean {
    if (this.changed || this.stillDirty || !this.programs.get(MESH)) return true;
    if (!this.backdrop && (this.skyMoves || this.particlesShown)) return true;
    return this.placed.some((b) => this.bakeDue(b, seconds));
  }

  /** The GPU's times for the frames drawn since last asked (ms), where it can be timed. */
  gpuTimes(): number[] {
    return this.timer.poll();
  }

  /** The scene at `seconds` on its clock; nothing while the meshes' program is still compiling (false). */
  draw(seconds: number): boolean {
    const gl = this.gl;
    const { width, height } = this.canvas;
    if (!this.programs.get(MESH)) return false;
    if (this.timing) this.timer.begin();
    if (this.stillDirty) this.drawStill();
    const viewProjection = multiply(this.projection, this.view);
    // The bodies that have changed (or whose layers have scrolled on) baked again first.
    for (const body of this.placed)
      if (this.bakeDue(body, seconds)) this.bakeBody(body, seconds, viewProjection);
    // In depth order: the background (as if infinitely far: under every object, wherever it is
    // set), what doesn't move of it and then what does; the scene's objects over it: the sky's
    // that don't move, the bodies (far to near), the sky's that move, at their depths; the
    // foreground over all of them (as if at the camera).
    for (const output of OUTPUTS) {
      const colour = output === 'colour';
      this.copy(this.stillBackground, this.frame, 'picture', output);
      gl.viewport(0, 0, width, height);
      this.drawMeshes(seconds, 'background', output, true);
      if (colour) this.drawParticles(seconds, 'background');
      this.composite(this.stillScene, output);
      this.copy(this.stillScene, this.frame, 'depth', output);
      this.compositeBodies(viewProjection, output);
      this.drawMeshes(seconds, 'scene', output, true);
      if (colour) this.drawParticles(seconds, 'scene');
      this.drawMeshes(seconds, 'foreground', output);
      if (colour) this.drawParticles(seconds, 'foreground');
    }

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this.drawBloom();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.toneProgram);
    gl.bindSampler(0, null); // the tone pass's textures sample as they are set
    gl.bindSampler(1, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[0]!.texture);
    gl.uniform1i(this.uniform(this.toneProgram, 'uBloom'), 1);
    gl.uniform1f(this.uniform(this.toneProgram, 'uBloomStrength'), BLOOM_STRENGTH);
    const tints = [this.tint, this.fadingFrom];
    gl.uniform3fv(
      this.uniform(this.toneProgram, 'uTint'),
      tints.flatMap((t) => [...t.colour]),
    );
    gl.uniform1iv(
      this.uniform(this.toneProgram, 'uBlend'),
      tints.map((t) => BLEND_MODES[t.blend]),
    );
    gl.uniform1f(this.uniform(this.toneProgram, 'uFade'), this.fade);
    gl.uniform1f(this.uniform(this.toneProgram, 'uExposure'), this.loaded.scene.tone.exposure);
    gl.uniform1f(this.uniform(this.toneProgram, 'uWhitePoint'), this.loaded.scene.tone.whitePoint);
    const b = this.backdrop;
    gl.uniform1i(
      this.uniform(this.toneProgram, 'uBackdrop'),
      b ? (b.kind === 'colour' ? 1 : 2) : 0,
    );
    if (b) {
      const [first, second] = b.kind === 'colour' ? [b.colour, b.colour] : b.colours;
      gl.uniform3fv(this.uniform(this.toneProgram, 'uBackdropA'), first);
      gl.uniform3fv(this.uniform(this.toneProgram, 'uBackdropB'), second);
      // The squares in CSS pixels, whatever share of the display's resolution the canvas has.
      const cssWidth = this.canvas.clientWidth || width;
      const size = b.kind === 'grid' ? b.size : 1;
      gl.uniform1f(
        this.uniform(this.toneProgram, 'uGridSize'),
        Math.max(1, (size * width) / cssWidth),
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawBeams();
    if (this.timing) this.timer.end();
    this.changed = false;
    return true;
  }

  /** What a body's bake is for: the view, the sky round it, the body as it is, the surfaces its shapes are hidden behind. */
  private bakeKey(body: Placed): string {
    return `${this.viewVersion}:${this.skyVersion}:${body.version}:${body.hasShapes ? this.surfacesKey : ''}`;
  }

  /** Whether a body has to be baked (again) for a frame at `seconds`. */
  private bakeDue(body: Placed, seconds: number): boolean {
    if (body.placement.hidden) return false;
    const b = body.bake;
    if (!b || !b.complete || b.key !== this.bakeKey(body)) return true;
    return b.scroll > 0 && Math.abs(seconds - b.at) * b.scroll >= REBAKE_PIXELS;
  }

  /**
   * A body drawn on its own into its bake: the frame's pixels it covers, each as the frame has it
   * (its view drawn with their corner at the bake's), its draws in its drawing order, at `seconds`.
   */
  private bakeBody(body: Placed, seconds: number, viewProjection: Float32Array): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const { position } = body.placement;
    const { axes } = body.frame;
    const e = body.extent;
    const corners: Vec3[] = [-1, 1].flatMap((sx) =>
      [-1, 1].map((sz): Vec3 => [
        position[0] + (axes[0]! * sx + axes[6]! * sz) * e,
        position[1] + (axes[1]! * sx + axes[7]! * sz) * e,
        position[2] + (axes[2]! * sx + axes[8]! * sz) * e,
      ]),
    );
    const rect = bakeRect(corners, viewProjection, width, height);
    const bake = (body.bake ??= this.newBake());
    bake.key = this.bakeKey(body);
    bake.at = seconds;
    bake.rect = rect;
    bake.complete = true;
    bake.scroll = 0;
    if (!rect) return;
    this.sizeBake(bake, rect);
    // Its pixels the frame's: the frame's view drawn with the rectangle's corner at the target's
    // (the rest falls off it), each pixel exactly as the frame would have it.
    gl.viewport(-rect.x, -rect.y, width, height);
    // Its program still compiling: nothing of it yet (it is baked again next frame).
    const p = this.programs.get(BODY);
    if (!p) {
      bake.complete = false;
      return;
    }
    gl.enable(gl.DEPTH_TEST);
    const v = this.view;
    const right = intoFrame(axes, [v[0]!, v[4]!, v[8]!]);
    const up = intoFrame(axes, [v[1]!, v[5]!, v[9]!]);
    const eyeDistance = Math.hypot(...body.frame.eye);
    const radius = body.placement.radius;
    // How wide a pixel is at the body, in the scene's units.
    const pixel =
      (2 * eyeDistance * radius * Math.tan((this.camera.fovY * Math.PI) / 360)) / height;
    // What every draw of the bake shares.
    gl.useProgram(p);
    gl.uniformMatrix4fv(this.uniform(p, 'uViewProjection'), false, viewProjection);
    gl.uniform1f(this.uniform(p, 'uSmear'), 0);
    gl.uniform1f(this.uniform(p, 'uSceneThreshold'), this.sceneThreshold());
    gl.uniform3fv(this.uniform(p, 'uCentre'), position);
    gl.uniformMatrix3fv(this.uniform(p, 'uAxes'), false, axes);
    gl.uniform1f(this.uniform(p, 'uRadius'), body.placement.radius);
    gl.uniform3fv(this.uniform(p, 'uEye'), body.frame.eye);
    gl.uniform3fv(this.uniform(p, 'uRight'), right);
    gl.uniform3fv(this.uniform(p, 'uUp'), up);
    // The sky round it, for its environment lights (past its materials' textures).
    gl.uniform4fv(
      this.uniform(p, 'uSkyAt'),
      frameSpot(position, radius, [v[0]!, v[4]!, v[8]!], viewProjection, width, height),
    );
    gl.activeTexture(gl.TEXTURE0 + SKY_LIGHT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.skyLight.texture);
    gl.bindSampler(SKY_LIGHT_UNIT, null);
    gl.uniform1i(this.uniform(p, 'uSkyLight'), SKY_LIGHT_UNIT);
    gl.uniform1i(this.uniform(p, 'uSurfaceCount'), this.surfaces.length);
    if (this.surfaces.length) gl.uniform4fv(this.uniform(p, 'uSurfaces'), this.surfaces.flat());
    for (const output of OUTPUTS) {
      this.bind(bake, output);
      gl.clearColor(0, 0, 0, 0);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1i(this.uniform(p, 'uOutput'), output === 'glow' ? 1 : 0);
      gl.bindVertexArray(this.quad);
      for (const s of body.states) {
        if (!s.enabled || !s.part) continue;
        this.applyState(p, s, seconds);
        // The square as wide as this part reaches (not the body's widest: fewer pixels to trace),
        // and two pixels past, for its edge's smoothing.
        const reachOf = partsExtent(radius, [s.part], eyeDistance * radius) + 2 * pixel;
        gl.uniform1f(this.uniform(p, 'uExtent'), Math.min(e, reachOf));
        const shape = s.part.shape;
        if (shape.kind === 'ring') {
          const k = ringScale(shape, eyeDistance);
          gl.uniform3f(
            this.uniform(p, 'uShapeParams'),
            shape.inner * k,
            shape.outer * k,
            shape.depth,
          );
        }
        this.blend(s.blend);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.bindVertexArray(null);
    }
    // How fast its scrolling layers move across it: it is baked again each half pixel they move.
    bake.scroll = scrollPixels(
      body.states
        .filter((s) => s.enabled)
        .flatMap((s) => s.scrolls.map(({ layer }) => layer))
        .flatMap((l) => (l.scroll ? [{ scroll: l.scroll, tiling: l.tiling }] : [])),
      rect,
    );
  }

  /** A state's uniforms given to its program (found once), its layers' scroll at `seconds`, its textures bound. */
  private applyState(p: WebGLProgram, s: DrawState, seconds: number): void {
    const gl = this.gl;
    let block = s.blocks.get(p);
    if (!block) s.blocks.set(p, (block = compileBlock(s.uniforms, (n) => this.uniform(p, n))));
    applyBlock(gl, block);
    for (const { slot, layer } of s.scrolls)
      gl.uniform2fv(this.uniform(p, `uLayers[${slot}].offset`), layerOffset(layer, seconds));
    for (let i = 0; i < s.textures.length; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, s.textures[i]!);
      gl.bindSampler(i, s.samplers[i]!);
    }
  }

  /**
   * The bodies' bakes put back into the frame (bound), far to near: first their opaque pixels'
   * depths (as drawing them would leave), then their colour over what is there, each pixel tested
   * at its depth (an added light, which has none, at its body's nearest).
   */
  private compositeBodies(viewProjection: Float32Array, output: Output): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const eye = this.camera.eye;
    const shown = this.placed
      .filter((b) => !b.placement.hidden && b.bake?.rect)
      .sort((a, b) => distance(b.placement.position, eye) - distance(a.placement.position, eye));
    if (!shown.length) return;
    const p = this.impostorProgram;
    gl.useProgram(p);
    gl.enable(gl.DEPTH_TEST);
    gl.uniform1i(this.uniform(p, 'uColor'), 0);
    gl.uniform1i(this.uniform(p, 'uDepth'), 1);
    for (let unit = 0; unit < 2; unit++) gl.bindSampler(unit, null);
    for (const body of shown) {
      const bake = body.bake!;
      const r = bake.rect!;
      gl.uniform4f(
        this.uniform(p, 'uRect'),
        (2 * r.x) / width - 1,
        (2 * r.y) / height - 1,
        (2 * (r.x + r.w)) / width - 1,
        (2 * (r.y + r.h)) / height - 1,
      );
      gl.uniform2i(this.uniform(p, 'uOrigin'), r.x, r.y);
      gl.uniform1f(this.uniform(p, 'uFront'), this.frontDepth(body, viewProjection));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, output === 'glow' ? bake.glow : bake.color);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bake.depth);
      // Its opaque pixels' depths.
      gl.uniform1i(this.uniform(p, 'uPass'), 0);
      gl.disable(gl.BLEND);
      gl.colorMask(false, false, false, false);
      gl.depthMask(true);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Its colour (or its glow) over what is there.
      gl.uniform1i(this.uniform(p, 'uPass'), 1);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.activeTexture(gl.TEXTURE0);
  }

  /** The depth of a body's nearest point (as far as its parts reach towards the eye), in the frame. */
  private frontDepth(body: Placed, viewProjection: Float32Array): number {
    const { position } = body.placement;
    const eye = this.camera.eye;
    const d = distance(eye, position);
    if (d <= 0) return 0;
    const r = Math.min(body.reachOf, d * 0.99);
    const p: Vec3 = [
      position[0] + ((eye[0] - position[0]) / d) * r,
      position[1] + ((eye[1] - position[1]) / d) * r,
      position[2] + ((eye[2] - position[2]) / d) * r,
    ];
    const m = viewProjection;
    const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
    if (w <= 0) return 0;
    const z = (m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!) / w;
    return Math.min(1, Math.max(0, z * 0.5 + 0.5));
  }

  /** A bake's framebuffer, its textures made when first sized. */
  private newBake(): Bake {
    return {
      framebuffer: this.gl.createFramebuffer(),
      color: null,
      depth: null,
      glowFramebuffer: this.gl.createFramebuffer(),
      glow: null,
      glowDepth: null,
      width: 0,
      height: 0,
      rect: null,
      key: '',
      at: 0,
      complete: false,
      scroll: 0,
    };
  }

  /** A bake's textures big enough for a rectangle (kept while it fits and isn't far too big). */
  private sizeBake(bake: Bake, rect: PixelRect): void {
    const fits = rect.w <= bake.width && rect.h <= bake.height;
    const roomy = bake.width > 2 * bakeSize(rect.w) || bake.height > 2 * bakeSize(rect.h);
    if (fits && !roomy) return;
    const gl = this.gl;
    bake.width = bakeSize(rect.w);
    bake.height = bakeSize(rect.h);
    const texture = (format: number) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, bake.width, bake.height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    };
    for (const t of [bake.color, bake.depth, bake.glow, bake.glowDepth]) gl.deleteTexture(t);
    bake.color = texture(this.format);
    bake.depth = texture(gl.DEPTH_COMPONENT24);
    bake.glow = texture(this.format);
    bake.glowDepth = texture(gl.DEPTH_COMPONENT24);
    this.attach(bake.framebuffer, bake.color, bake.depth);
    this.attach(bake.glowFramebuffer, bake.glow, bake.glowDepth);
  }

  /** A framebuffer's colour and depth textures, attached. */
  private attach(framebuffer: WebGLFramebuffer, colour: WebGLTexture, depth: WebGLTexture): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colour, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  }

  /** A bake's GPU memory freed. */
  private freeBake(bake: Bake | null): void {
    if (!bake) return;
    const gl = this.gl;
    for (const t of [bake.color, bake.depth, bake.glow, bake.glowDepth]) gl.deleteTexture(t);
    gl.deleteFramebuffer(bake.framebuffer);
    gl.deleteFramebuffer(bake.glowFramebuffer);
  }

  /** Beams to show over the picture (none: none); drawn at the next frame. */
  setBeams(beams: readonly LightAid[]): void {
    if (beams === this.beams) return;
    this.beams = beams;
    this.changed = true;
  }

  /**
   * The beams over the picture as shown (after its exposure and bloom: as they are whatever the
   * scene's light), each hidden where the frame's depth is nearer; one that lights adds its
   * colour, one that darkens takes it away.
   */
  private drawBeams(): void {
    if (!this.beams.length) return;
    const gl = this.gl;
    gl.disable(gl.CULL_FACE); // a beam's far side as well as its near: as deep as it is seen through
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindSampler(0, null);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.depth);
    const viewProjection = multiply(this.projection, this.view);
    const eye = this.camera.eye;
    // The bodies' spheres (the nearest first) that hide what is behind them.
    const spheres = this.placed
      .map(({ placement: { position, radius } }) => [...position, radius] as const)
      .sort((a, b) => distance([a[0], a[1], a[2]], eye) - distance([b[0], b[1], b[2]], eye))
      .slice(0, MAX_BEAM_SPHERES);
    const shared = (p: WebGLProgram) => {
      gl.useProgram(p);
      gl.uniform1i(this.uniform(p, 'uDepth'), 0);
      gl.uniformMatrix4fv(this.uniform(p, 'uViewProjection'), false, viewProjection);
      gl.uniform3fv(this.uniform(p, 'uEye'), eye);
      gl.uniform1i(this.uniform(p, 'uSphereCount'), spheres.length);
      if (spheres.length) gl.uniform4fv(this.uniform(p, 'uSpheres'), spheres.flat());
    };
    const outlines = this.beams.filter((b): b is LightOutline => b.shape === 'outline');
    if (outlines.length) {
      shared(this.outlineProgram);
      gl.bindVertexArray(this.quad);
      for (const o of outlines) this.drawOutline(o);
    }
    const beams = this.beams.filter((b) => b.shape === 'beam');
    if (!beams.length) {
      gl.bindVertexArray(null);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      return;
    }
    const p = this.beamProgram;
    shared(p);
    gl.bindVertexArray(this.beamVao);
    for (const beam of beams) {
      const way = normalize(beam.from);
      const [across, up] = beamAcross(way);
      gl.uniform3fv(this.uniform(p, 'uCentre'), beam.centre);
      gl.uniform4f(this.uniform(p, 'uBody'), ...beam.centre, beam.radius);
      gl.uniform3fv(this.uniform(p, 'uWay'), way);
      gl.uniform3fv(this.uniform(p, 'uAcross'), across);
      gl.uniform3fv(this.uniform(p, 'uUp'), up);
      gl.uniform1f(this.uniform(p, 'uRadius'), beam.radius);
      gl.uniform1f(this.uniform(p, 'uLength'), beam.radius * BEAM_LENGTH);
      gl.uniform3fv(this.uniform(p, 'uColor'), beam.colour);
      gl.uniform1i(this.uniform(p, 'uEdge'), 0);
      // Its colour added, or taken away (the shown picture's alpha kept either way); one taken
      // away with its edges lit faintly as well.
      if (beam.darkens) {
        gl.uniform1f(this.uniform(p, 'uAlpha'), DARK_BEAM_ALPHA);
        gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
        gl.drawArrays(gl.TRIANGLES, 0, this.beamCount);
        gl.uniform1i(this.uniform(p, 'uEdge'), 1);
        gl.uniform3f(this.uniform(p, 'uColor'), 1, 1, 1);
        gl.uniform1f(this.uniform(p, 'uAlpha'), BEAM_EDGE_ALPHA);
      } else {
        gl.uniform1f(this.uniform(p, 'uAlpha'), BEAM_ALPHA);
      }
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, this.beamCount);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /**
   * An outline drawn on its body's sphere (the outline program in use, the square bound): its
   * body's other spheres hide it, not its own; its colour added (a darkening light's: white).
   */
  private drawOutline(o: LightOutline): void {
    const gl = this.gl;
    const p = this.outlineProgram;
    const rad = Math.PI / 180;
    gl.uniform3fv(this.uniform(p, 'uCentre'), o.centre);
    gl.uniformMatrix3fv(this.uniform(p, 'uAxes'), false, o.axes);
    gl.uniform1f(this.uniform(p, 'uRadius'), o.radius);
    gl.uniform1f(this.uniform(p, 'uExtent'), o.radius * OUTLINE_EXTENT);
    gl.uniform1i(this.uniform(p, 'uKind'), o.kind);
    gl.uniform3fv(this.uniform(p, 'uDir'), o.direction);
    gl.uniform3fv(this.uniform(p, 'uPos'), o.position);
    gl.uniform3fv(this.uniform(p, 'uAim'), o.aim);
    gl.uniform1f(this.uniform(p, 'uFade'), o.fade);
    gl.uniform1f(this.uniform(p, 'uCosCone'), Math.cos(o.cone * rad));
    gl.uniform1f(this.uniform(p, 'uCosFade'), Math.cos(o.cone * (1 - o.edge) * rad));
    gl.uniform3fv(this.uniform(p, 'uColor'), o.darkens ? [1, 1, 1] : o.colour);
    gl.uniform1f(this.uniform(p, 'uAlpha'), OUTLINE_ALPHA);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Free what the GPU holds; the context goes with the canvas anyway. */
  dispose(): void {
    const gl = this.gl;
    for (const t of this.textures.values()) gl.deleteTexture(t);
    for (const s of this.samplers) gl.deleteSampler(s);
    for (const vao of [...this.vaos, ...this.skyOverlayVaos]) gl.deleteVertexArray(vao);
    gl.deleteVertexArray(this.quad);
    for (const p of this.particles) {
      gl.deleteVertexArray(p.vao);
      gl.deleteBuffer(p.buffer);
    }
    // (Its programs are the context's, kept for the next scene: see `programsOf`.)
    gl.deleteVertexArray(this.beamVao);
    for (const target of this.bloom) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.framebuffer);
    }
    for (const target of [this.stillBackground, this.stillScene, this.frame]) {
      for (const t of [target.texture, target.depth, target.glow, target.glowDepth])
        gl.deleteTexture(t);
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteFramebuffer(target.glowFramebuffer);
    }
    for (const placed of this.placed) this.freeBake(placed.bake);
    this.timer.dispose();
  }

  /** A target sized to the canvas: a texture's storage is fixed, so a new size is a new texture. */
  private allocate(target: Target): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const texture = (format: number) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    };
    for (const t of [target.texture, target.depth, target.glow, target.glowDepth])
      gl.deleteTexture(t);
    target.texture = texture(this.format);
    target.depth = texture(gl.DEPTH_COMPONENT24);
    target.glow = texture(this.format);
    target.glowDepth = texture(gl.DEPTH_COMPONENT24);
    this.attach(target.framebuffer, target.texture, target.depth);
    this.attach(target.glowFramebuffer, target.glow, target.glowDepth);
  }

  /** A target's colour and glow from black (covering as far as `alpha` says), nothing in front yet. */
  private begin(target: Target, alpha: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, alpha);
    gl.depthMask(true);
    for (const output of OUTPUTS) {
      this.bind(target, output);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  }

  /** A blend: opaque writes colour and depth; the rest add or blend over. */
  private blend(blend: SceneBlend): void {
    const gl = this.gl;
    if (blend === 'opaque') {
      // Opaque but for a body's smoothed edge, which it gives as its alpha (premultiplied).
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(true);
      return;
    }
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (blend === 'alpha') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // Added light covers nothing: the alpha (what a backdrop shows under) is left as it is.
    else gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
  }

  /**
   * A draw's material's settings: the placement's say (by its key) over its owner's tuning (a
   * planet's for its materials, an overlay's for the overlay's) and, an overlay's, how the planet
   * wears it and the material's base settings; or the sky's as set (an overlay's over its base).
   */
  private settingsOf(draw: MeshDraw): MaterialSettings | undefined {
    const placement = draw.placed?.placement;
    if (!placement)
      return draw.overlay
        ? mergeSettings(this.sky.base?.[draw.name], this.sky.materials?.[draw.key])
        : this.sky.materials?.[draw.key];
    const wear = draw.overlay ? wearOf(placement.planet.planet, draw.overlay) : undefined;
    return mergeSettings(
      draw.owner?.planet.tuning?.materials?.[draw.name],
      wear?.materials?.[draw.name],
      draw.overlay ? placement.base?.[draw.name] : undefined,
      placement.materials?.[draw.key],
    );
  }

  /**
   * The sky's draws at a depth (those that move, or those that don't, if asked; the foreground's
   * all), into the bound target: the scene's depth-tested, the background's and foreground's
   * drawn over what is there. None in front of a backdrop.
   */
  private drawMeshes(
    seconds: number,
    depth: MaterialDepth,
    output: Output,
    moving?: boolean,
  ): void {
    if (this.backdrop) return;
    const draws = this.skyStates.filter(
      (s) => s.enabled && s.depth === depth && (moving === undefined || s.moving === moving),
    );
    if (!draws.length) return;
    const gl = this.gl;
    this.depthTest(depth);
    const viewProjection = multiply(this.projection, this.view);
    const v = this.view;
    const threshold = this.sceneThreshold();
    // What every mesh drawn shares.
    const p = this.programs.get(MESH)!;
    gl.useProgram(p);
    gl.uniformMatrix4fv(this.uniform(p, 'uViewProjection'), false, viewProjection);
    gl.uniform1f(this.uniform(p, 'uSceneThreshold'), threshold);
    gl.uniform1f(this.uniform(p, 'uGlowThreshold'), threshold); // the sky: no glow of its own
    gl.uniform1i(this.uniform(p, 'uPattern'), 0);
    gl.uniform1i(this.uniform(p, 'uShadeCount'), 0);
    this.bindTint(p, 'uBodyTint', this.sky.tint); // the sky's over all of it
    gl.uniform2f(this.uniform(p, 'uRimTurn'), 0, 0);
    gl.uniform3fv(this.uniform(p, 'uEye'), this.camera.eye);
    gl.uniform3f(this.uniform(p, 'uRight'), v[0]!, v[4]!, v[8]!);
    gl.uniform3f(this.uniform(p, 'uUp'), v[1]!, v[5]!, v[9]!);
    gl.uniform1f(this.uniform(p, 'uSmear'), this.smear);
    gl.uniform1i(this.uniform(p, 'uLit'), 0);
    gl.uniform1i(this.uniform(p, 'uOutput'), output === 'glow' ? 1 : 0);
    for (const s of draws) {
      gl.bindVertexArray(s.draw.vao);
      this.blend(s.blend);
      if (depth !== 'scene') gl.depthMask(false); // as if infinitely far, or at the camera
      this.applyState(p, s, seconds);
      gl.drawElements(gl.TRIANGLES, s.draw.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  /** A tint into the uniforms `<name>Color`, `<name>Blend` and `<name>Strength` (none: strength 0). */
  private bindTint(p: WebGLProgram, name: string, tint: MaterialTint | undefined): void {
    const u = new UniformSet();
    tintUniforms(u, name, tint);
    applyBlock(
      this.gl,
      compileBlock(u, (n) => this.uniform(p, n)),
    );
  }

  /**
   * The bodies' surfaces a shape part is hidden behind (the body shader's `uSurfaces`): each shown
   * body's surface, its sphere in the world, where a material on it is on; the nearest first.
   */
  private updateSurfaces(): void {
    const surfaces: number[][] = [];
    for (const placed of this.placed) {
      const seen = new Set<PartKey | undefined>();
      for (const s of placed.states) {
        const { part } = s;
        if (!s.enabled || s.draw.part?.role !== 'surface' || part?.shape.kind !== 'sphere')
          continue;
        if (seen.has(s.draw.partKey)) continue;
        seen.add(s.draw.partKey);
        const { shape } = part;
        const { position, radius } = placed.placement;
        const [x, y, z] = (shape.centre ?? [0, 0, 0]).map((c) => c * radius) as [
          number,
          number,
          number,
        ];
        const a = placed.frame.axes;
        surfaces.push([
          position[0] + a[0]! * x + a[3]! * y + a[6]! * z,
          position[1] + a[1]! * x + a[4]! * y + a[7]! * z,
          position[2] + a[2]! * x + a[5]! * y + a[8]! * z,
          shape.radius * radius,
        ]);
      }
    }
    const eye = this.camera.eye;
    this.surfaces = surfaces
      .sort((a, b) => distance(a as unknown as Vec3, eye) - distance(b as unknown as Vec3, eye))
      .slice(0, MAX_SURFACES);
    this.surfacesKey = JSON.stringify(this.surfaces);
  }

  /**
   * A placed planet's shade as the data has it: its own over its overlays' over the default (none).
   * The planet's own tuning shades it as it is; an overlay it wears shades it its way instead, as
   * the planet wears it (the later over the earlier).
   */
  private shadeOf(placement: PlanetPlacement): BodyShade {
    const worn = overlaysOf(placement);
    const wears = wearsIn(placement);
    return {
      ...DEFAULT_SHADE,
      ...placement.planet.planet.tuning?.shade,
      ...worn.reduce(
        (a: Partial<BodyShade>, o, i) => ({ ...a, ...o.planet.shade, ...wears[i]?.shade }),
        {},
      ),
      ...placement.shade,
    };
  }

  private material(
    name: string,
    where: string,
    materials: Readonly<Record<string, SceneMaterial>>,
  ): SceneMaterial {
    const material = materials[name];
    if (!material) throw new Error(`${where}: no material ${name} in the scene`);
    if (!['opaque', 'alpha', 'add', 'alphaAdd'].includes(material.blend))
      throw new Error(`${name}: ${material.blend} blending isn't drawn yet`);
    return material;
  }

  private uniform(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let names = this.uniforms.get(p);
    if (!names) this.uniforms.set(p, (names = new Map()));
    if (!names.has(name)) names.set(name, this.gl.getUniformLocation(p, name));
    return names.get(name)!;
  }

  private texture(image: ImageBitmap): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  private meshVao(mesh: SceneMesh): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attribute = (
      name: string,
      data: ArrayBufferView,
      size: number,
      type: number,
      normalized: boolean,
    ) => {
      const at = ATTRIBUTES[name]!;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, size, type, normalized, 0, 0);
    };
    attribute('aPosition', new Float32Array(mesh.positions), 3, gl.FLOAT, false);
    attribute('aUv', new Float32Array(mesh.uvs), 2, gl.FLOAT, false);
    attribute('aUv2', new Float32Array(mesh.uvs2 ?? mesh.uvs), 2, gl.FLOAT, false);
    const normals = mesh.normals
      ? new Float32Array(mesh.normals)
      : new Float32Array(mesh.positions.length); // none: zeros, never read
    attribute('aNormal', normals, 3, gl.FLOAT, false);
    attribute('aColor', new Uint8Array(mesh.colors), 4, gl.UNSIGNED_BYTE, true);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return vao;
  }

  /** The square a body's parts are drawn on: its corners, -1 to 1, as a strip. */
  private quadVao(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = ATTRIBUTES['aCorner']!;
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  /** A beam's tube on the GPU (see `beamTube`). */
  private tubeVao(tube: Float32Array): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, tube, gl.STATIC_DRAW);
    const at = ATTRIBUTES['aTube']!;
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private particleVao(particles: ParticleSystem): [WebGLVertexArrayObject, WebGLBuffer] {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    );
    const corner = ATTRIBUTES['aCorner']!;
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, particles.instances.byteLength, gl.DYNAMIC_DRAW);
    const stride = INSTANCE_FLOATS * 4;
    for (const [name, offset] of [
      ['aParticle', 0],
      ['aParticleColor', 16],
    ] as const) {
      const at = ATTRIBUTES[name]!;
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(at, 1);
    }
    gl.bindVertexArray(null);
    return [vao, buffer];
  }
}
