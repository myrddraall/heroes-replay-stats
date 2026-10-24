import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DataTexture,
  DepthTexture,
  FloatType,
  FrontSide,
  HalfFloatType,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  type Material,
  Mesh,
  NearestFilter,
  NoColorSpace,
  NodeMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  RenderTarget,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  Texture,
  UnsignedByteType,
  Vector2,
  WebGPURenderer,
} from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';
import {
  type LoadedPlayScene,
  layerOffset,
  type SceneBlend,
  type SceneCamera,
  type SceneCameraSet,
  type SceneLayer,
  type SceneMaterial,
  type SceneMesh,
  type SkyOverlayFile,
} from '../play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from '../scene-particles';
import { DEFAULT_ACTIVE, gridFields, MATERIAL_DEFAULTS, materialKey, materialValues, mergeSettings } from '../material-settings';
import { rimTurn } from '../scene-directions';
import { BEAM_LENGTH, beamAcross, beamTube, type LightAid, type LightOutline, OUTLINE_EXTENT } from '../scene-beams';
import { fitTube, type Tube, tubeCover } from '../scene-tubes';
import { overlayOfFile } from '../overlays';
import { skyOverlayParts } from '../sky-overlays';
import { skyDepths } from '../sky-depths';
import { anchoredDepth, anchoredView, skyAnchorOf } from '../sky-anchors';
import {
  type AddedLight,
  addedLighting,
  bodyDarkenings,
  linkedSettings,
  tunedRig,
  withAddedLights,
  withLightSettings,
} from '../scene-lights';
import {
  type BodyPart,
  type BodyShade,
  DEFAULT_SHADE,
  drawOrder,
  type LoadedPlanet,
  type MaterialDepth,
  type MaterialSettings,
  ownPartKey,
  overlayOfPartKey,
  overlayPartKey,
  type PartKey,
  type PlanetLight,
  type SkyAnchor,
  type SkySettings,
  wearOf,
  withLayers,
  withMasks,
  withPart,
  wornParts,
} from '../scene-planets';
import { BLEND_MODES, NO_TINT, type Tint } from '../scene-tints';
import { MAX_BEAM_SPHERES, MAX_SURFACES } from '../scene-limits';
import { UniformSet } from '../scene-uniforms';
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
} from '../draw-uniforms';
import { bakeRect, bakeSize, frameSpot, type PixelRect, REBAKE_PIXELS, scrollPixels } from '../body-bakes';
import {
  type Backdrop,
  bodyFrame,
  type BodyFrame,
  eyeOf,
  multiplyMatrices as multiply,
  type PlanetPlacement,
  partsExtent,
  projectionMatrix,
  reach,
  viewMatrix,
  viewUp,
} from '../scene-space';
import { bodyNodes } from './shader-body';
import { meshNodes } from './shader-mesh';
import { type Slot, SLOTS, TextureSlots } from './shader-material';
import {
  beamMaterial,
  bloomBlurMaterial,
  bloomPrepassMaterial,
  compositeMaterial,
  copyDepthMaterial,
  copyMaterial,
  downsampleMaterial,
  impostorMaterial,
  outlineMaterial,
  particleMaterial,
  PassQuad,
  setBlend,
  type ToClip,
  toneMaterial,
} from './shader-passes';
import { DrawValues, ShaderUniforms, withValues } from './shader-uniforms';
import { coldVertex } from './cold-shaders';
import { mipChain, prepareMipmaps } from './mipmaps';

/**
 * The Play screen's scene drawn with three.js (WebGPU, or its WebGL 2 backend where the browser
 * has no WebGPU): the sky's meshes through the game's camera, the placed planets' bodies each on
 * camera-facing squares (their parts' shapes found under each pixel: no mesh), then the particles
 * as camera-facing squares, into a half-float target (light adds up past white, as in the game's
 * HDR), tone-mapped onto the canvas. Opaque materials draw first and hide what is behind them; the
 * blended ones follow by priority. Its shaders are written in three.js's shading language
 * (`shader-*.ts`).
 *
 * What is drawn is worked out once on the CPU and kept (`DrawState`): each draw's settings,
 * material, light and uniforms, made again only when what they come from changes (a body's
 * placement, the sky's settings, the scene's lights). What doesn't move is drawn once and kept
 * too: the sky's (the nebula and stars) in targets of its own, colour and depth, each frame
 * starting from a copy of them; each body on its own (`Bake`), put back into each frame pixel for
 * pixel, baked again only when it changes, the view does, or its scrolling layers have moved half
 * a pixel. A frame is only worth drawing when something has changed or moves (`needsFrame`). Each
 * target also keeps what glows beyond the scene's own bloom, drawn in a pass of its own (`OUTPUTS`),
 * then the bloom and the tone mapping.
 *
 * One material for each kind of draw (a body's part, a sky mesh), blend and depth, which every
 * draw of its kind shares, each draw's values and textures its own (`DrawValues`), so its shader is
 * built and compiled once, whatever the draws are; on WebGPU, textures come with their mipmaps
 * ready-made (`mipChain`); and programs compile in the background, apart from the textures (a draw
 * is left out until its program is compiled and its textures are ready).
 * Its public interface is `BackgroundRenderer` (background-renderer.ts).
 */

/**
 * What a draw writes: the colour, or the glow (what blooms beyond the scene's own bloom). Each goes
 * to a target of its own, in a pass of its own, never both at once: with Direct3D (ANGLE), a
 * program linked for one output is compiled again, uncached, the first time it draws into two,
 * and for the bodies' shader that takes the whole browser away for ten seconds or more on every
 * load (the uniform `uOutput` says which a draw writes). A body is baked twice only when it
 * changes; per frame only what moves of the sky is drawn twice (the particles glow not at all:
 * drawn once).
 */
const OUTPUTS = ['colour', 'glow'] as const;
type Output = (typeof OUTPUTS)[number];

/** How many hexes a drawn hex pattern has round a body at scale 1, where it doesn't say how many its texture has. */
const HEX_ROUND = 24;
/**
 * How strongly the bloom is added back, how many times it is blurred across and down, how far
 * apart its taps are (in its texels) and how much smaller than the canvas it is: together, how
 * far it spreads (about a tenth of the view's height).
 */
const BLOOM_STRENGTH = 1.5;
/** The sky light's texture's size (square). */
const SKY_LIGHT_SIZE = 64;
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

type Vec3 = readonly [number, number, number];

/** The editor's aids' kinds: an outline, a light's beam, a darkening one's, and its edges. */
type AidKind = 'outline' | 'light' | 'dark' | 'edge';

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

/** A vector turned about an axis (unit) by an angle in radians. */
function turnAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const d = dot(axis, v) * (1 - c);
  return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
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
 * from `d` (both in the body's radii), but for a factor: the limb's tangent (1 over the root of
 * d² - 1) times the ring's distance from the eye. A ring modelled to lie on the limb from one
 * distance keeps to it from another, scaled by the ratio of the two.
 */
const ringFit = (d: number, depth: number) =>
  Number.isFinite(d) ? (d + depth) / Math.sqrt(Math.max(d * d - 1, 1e-6)) : 1;
/** How much bigger a ring is drawn seen from `d` (the body's radii) than as modelled. */
const ringScale = (shape: { readonly depth: number; readonly seen?: number }, d: number) =>
  shape.seen ? ringFit(d, shape.depth) / ringFit(shape.seen, shape.depth) : 1;

/** A number for each sky overlay's file, to tell a changed one (one made in the editor) apart. */
const fileIds = new WeakMap<object, number>();
let nextFileId = 0;
const fileId = (file: object) => {
  let id = fileIds.get(file);
  if (id === undefined) fileIds.set(file, (id = nextFileId++));
  return id;
};

/**
 * One material drawn on one mesh, or on one part of a placed planet's body; moving when one of
 * its layers scrolls.
 */
interface MeshDraw {
  /** The mesh's geometry (the sky's); none: a body's square. */
  readonly geometry?: BufferGeometry;
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
  /** What its GPU draw is kept by, across the times it is worked out again. */
  readonly id: string;
}

/** A placement with its body's frame as last placed. */
interface Placed {
  readonly id: number;
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

/**
 * A draw as it is drawn: worked out once from its material, its settings and its body (when one
 * of them changes, not each frame), its uniforms then given to its shader as they are; its GPU
 * side found by its draw's id.
 */
interface DrawState {
  readonly draw: MeshDraw;
  /** Whether it is drawn at all: switched on, its body and its part shown. */
  readonly enabled: boolean;
  readonly depth: MaterialDepth;
  /** How a sky draw is anchored against the camera (a body's: fixed in the world). */
  readonly anchor: SkyAnchor;
  readonly blend: SceneBlend;
  readonly moving: boolean;
  /** Its material as set (its masks, its layers' textures and transforms, lit or flat). */
  readonly material: SceneMaterial;
  /** Its uniforms but for where it is seen from and the time (a scrolling layer's offset). */
  readonly uniforms: UniformSet;
  /** Its layers that scroll, by slot. */
  readonly scrolls: readonly { readonly slot: number; readonly layer: SceneLayer }[];
  /** A body's part as set: its shape, its mappings. */
  readonly part?: BodyPart;
  /** What it was worked out from (the sky's draws: whether they have to be drawn again). */
  readonly signature: string;
}

/** An impostor drawn for a bake: its mesh (the impostors' shared material) in its scene, and its values (the bake's textures). */
interface ImpostorDraw {
  readonly mesh: Mesh;
  readonly scene: Scene;
  readonly uniforms: DrawValues;
}

/** A draw's GPU side: its mesh (its kind's shared material), and its values. */
interface GpuDraw {
  /** What it was made for: its kind of draw (each kind one shader), its blend and depth, and its textures. */
  readonly key: string;
  readonly mesh: Mesh;
  readonly uniforms: DrawValues;
  /** Whether its program has compiled (it is left out until then), and whether it is compiling. */
  ready: boolean;
  compiling?: boolean;
  /** Its kind's shader (its draws share programs and pipelines: see `compileWaiting`). */
  readonly state: string;
  /** Let go of while compiling: freed when its compile is done (see `release`). */
  dropped?: boolean;
  /** The draw it replaces (other textures, blend or depth), kept drawable till this one is ready. */
  replaces?: Releasable;
}

/** A GPU side that can be let go of: its mesh, its values, and whether it is compiling. */
interface Releasable {
  readonly mesh: Mesh;
  readonly uniforms: DrawValues;
  compiling?: boolean;
  dropped?: boolean;
}

/** A float render target (half floats) and its glow, drawn in a pass of its own (see `OUTPUTS`), each with its depth. */
interface Pass {
  colour: RenderTarget;
  glow: RenderTarget;
}

/**
 * A body drawn on its own (baked), into a target the size of the pixels it covers: put back into
 * each frame as it is, until it changes (or the view does, or its layers scroll a pixel on).
 */
interface Bake {
  pass: Pass | null;
  /** Its targets' size. */
  width: number;
  height: number;
  /** The frame's pixels it covers, from the bottom left as `bakeRect` gives them (none: none shows). */
  rect: PixelRect | null;
  /** What it was baked for (the view, the body, the surfaces in front of its shapes). */
  key: string;
  /** The time it was baked at, on the scene's clock. */
  at: number;
  /** Whether its programs were ready (else it is baked again, next frame). */
  complete: boolean;
  /** How many pixels a second its scrolling layers move across it (0: none scroll). */
  scroll: number;
  /** How many rows down its bake the rectangle starts (0 or 1: see `bakeBody`). */
  shift: number;
}

interface ParticleDraw {
  /** Its material's name (the sky's settings for it apply). */
  readonly name: string;
  readonly system: ParticleSystem;
  readonly geometry: InstancedBufferGeometry;
  readonly buffer: InstancedInterleavedBuffer;
  readonly material: SceneMaterial;
  gpu: {
    mesh: Mesh;
    uniforms: DrawValues;
    depth: MaterialDepth;
    ready: boolean;
    compiling?: boolean;
    dropped?: boolean;
    readonly state: string;
  } | null;
}

/** Every blend a scene draw can have (see `keepers`). */
const BLEND_KINDS: readonly SceneBlend[] = ['opaque', 'alpha', 'add', 'alphaAdd'];

/** A shared material's key: its kind of draw, its blend, and whether it is depth tested (a body always is). */
const sharedKey = (body: boolean, blend: SceneBlend, depth: MaterialDepth) =>
  JSON.stringify([body ? 'body' : 'mesh', blend, body || depth === 'scene']);

const moves = (m: SceneMaterial) =>
  [m.diffuse, m.emissive, m.specular, ...m.alphaMasks].some((layer) => layer?.scroll);

function shown(draw: MeshDraw): boolean {
  const placement = draw.placed?.placement;
  if (!placement) return true;
  return !placement.hidden && !(draw.partKey && placement.parts?.[draw.partKey]?.enabled === false);
}

const overlaysOf = (placement: PlanetPlacement) => placement.overlays ?? [];

/** Whether two placements wear the same overlays, in the same order. */
const sameOverlays = (a: PlanetPlacement, b: PlanetPlacement) =>
  overlaysOf(a).length === overlaysOf(b).length && overlaysOf(a).every((o, i) => o === overlaysOf(b)[i]);
const wearsIn = (placement: PlanetPlacement) =>
  overlaysOf(placement).map((o) => wearOf(placement.planet.planet, overlayOfFile(o.id)));
const overlayParts = (placement: PlanetPlacement, overlay: LoadedPlanet): readonly BodyPart[] =>
  wornParts(placement.planet.planet, overlayOfFile(overlay.id), overlay.planet.parts);

function partsOf(placement: PlanetPlacement): readonly BodyPart[] {
  return [
    ...placement.planet.planet.parts.map((p) => withPart(p, placement.parts?.[ownPartKey(p)])),
    ...overlaysOf(placement).flatMap((o) =>
      overlayParts(placement, o).map((p) => withPart(p, placement.parts?.[overlayPartKey(overlayOfFile(o.id), p)])),
    ),
  ];
}

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
    (a, b) => Number(a.blend !== 'opaque') - Number(b.blend !== 'opaque') || rank.get(a)! - rank.get(b)!,
  );
}

/** A float target the canvas's size (or another), with its depth as a texture. */
function floatTarget(width: number, height: number, depth = true): RenderTarget {
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: depth,
  });
  target.texture.colorSpace = NoColorSpace;
  if (depth) {
    target.depthTexture = new DepthTexture(width, height);
    target.depthTexture.type = FloatType;
  }
  return target;
}

/** Resolves once a WebGL context's GPU has done all the work sent to it so far (polled, not waited on); rejects if the context is lost. */
export function fenced(gl: WebGL2RenderingContext): Promise<void> {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (gl.isContextLost()) reject(new Error('the context was lost'));
      else if (!sync || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) {
        if (sync) gl.deleteSync(sync);
        resolve();
      } else setTimeout(poll, 4);
    };
    poll();
  });
}

/**
 * A draw's GPU side let go of: three.js's state for its mesh (its bindings; the programs and
 * pipelines it holds), its table, and its material unless the material is shared.
 */
function freeGpu(gpu: { readonly mesh: Mesh; readonly uniforms: DrawValues }): void {
  const material = gpu.mesh.material as NodeMaterial;
  (gpu.mesh as unknown as { dispatchEvent(event: { type: 'dispose' }): void }).dispatchEvent({ type: 'dispose' });
  if (!material.userData['shared']) material.dispose();
  gpu.uniforms.texture?.dispose();
}


/** A sky mesh's geometry: its points, both uv sets, normals and colours, and its triangles. */
function meshGeometry(mesh: SceneMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(mesh.uvs), 2));
  g.setAttribute('uv1', new BufferAttribute(new Float32Array(mesh.uvs2 ?? mesh.uvs), 2));
  g.setAttribute(
    'normal',
    new BufferAttribute(mesh.normals ? new Float32Array(mesh.normals) : new Float32Array(mesh.positions.length), 3),
  );
  g.setAttribute('color', new BufferAttribute(new Uint8Array(mesh.colors), 4, true));
  g.setIndex(new BufferAttribute(new Uint16Array(mesh.indices), 1));
  return g;
}

let nextPlacedId = 0;

export class ThreeSceneRenderer {
  private readonly renderer: WebGPURenderer;
  /** Whether three.js is up (its backend chosen and started). */
  private started = false;
  private failed = false;
  /** Why it stopped drawing, if it did (three.js wouldn't start, or a program failed). */
  private failure: string | null = null;
  /** Clip space into the API's: WebGPU's depth runs 0 to w (`toClip`). */
  private toClip: ToClip = (clip) => clip;
  private readonly camera3 = new PerspectiveCamera();
  private readonly square = new PlaneGeometry(2, 2);
  private readonly placeholder: Texture;
  private readonly textures = new Map<string, ImageBitmap>();
  /**
   * Each image's mipmaps on WebGPU (`mipChain`), by its key, made as a draw first needs it (null
   * meanwhile; false where they couldn't be made: three.js makes them). WebGL's are its driver's
   * (generateMipmap, which needs no pipeline of three.js's).
   */
  private readonly mips = new Map<string, ImageBitmap[] | null | false>();
  /** The textures as the layers sample them, by image and how they repeat (one image, several ways). */
  private readonly sampled = new Map<string, Texture>();
  private readonly gpuDraws = new Map<string, GpuDraw>();
  /** The scenes the draws are drawn from: the sky's, and each body's (by its id). */
  private readonly skyScene = new Scene();
  private readonly bodyScenes = new Map<number, Scene>();
  private readonly particleScene = new Scene();
  /** How many batches of programs are compiling, and whether one is asked for (see `requestCompile`). */
  private compiling = 0;
  private compileAsked = false;
  /** Each shader and state's compiles in flight, and its draws compiled meanwhile (ready when none is). */
  private readonly inFlight = new Map<
    string,
    { count: number; done: (Releasable & { ready: boolean; replaces?: Releasable })[] }
  >();
  /** A placeholder texture of each slot's own (see `TextureSlots`). */
  private readonly slotPlaceholders: Readonly<Record<Slot, Texture>>;
  /** Each kind of draw's material, for each blend and depth, shared by its draws (see `sharedMaterial`). */
  private readonly sharedMaterials = new Map<string, NodeMaterial>();
  /**
   * A draw of each shared material, with placeholder textures, kept for the renderer's life (by
   * its material's key): a body's for each blend it can be drawn with, a sky mesh's for each its
   * sky has. Each compiles its material's program at once, whether its draws' textures are ready
   * or not, and holds it (three.js lets go of a program, and of a material's built shader, once
   * none of its meshes use it), so a new set of planets builds and compiles nothing.
   */
  private readonly keepers = new Map<string, GpuDraw>();
  /**
   * Each bake's impostors (its colour's and its glow's, passes 0 and 1), its own objects, the
   * impostors' two materials shared: a texture swapped into an object after its first draw may
   * stay unbound on WebGPU, which keeps an object's bindings.
   */
  private readonly bakeImpostors = new Map<Pass, Record<Output, ImpostorDraw[]>>();
  private readonly keeperScene = new Scene();
  private readonly sceneDraws: MeshDraw[] = [];
  private skyOverlayDraws: MeshDraw[] = [];
  private skyStates: DrawState[] = [];
  private skySignature = '';
  private skyMoves = false;
  private particlesShown = false;
  private skyOverlayKey = '';
  private skyOverlayGeometries: BufferGeometry[] = [];
  private readonly planetsLoaded = new WeakSet<LoadedPlanet>();
  private placed: Placed[] = [];
  private readonly particles: ParticleDraw[] = [];
  private stillBackground: Pass | null = null;
  private stillScene: Pass | null = null;
  private frame: Pass | null = null;
  /**
   * What doesn't move of the sky, small (SKY_LIGHT_SIZE square, blurred as read), for the
   * environment lights: drawn again with the still sky; bodies are baked again when it is
   * (`skyVersion`).
   */
  private skyLight: RenderTarget;
  /** It at half its size and at a quarter: its mipmaps one and two, made by passes of their own. */
  private readonly skyLightHalf: RenderTarget;
  private readonly skyLightQuarter: RenderTarget;
  private bloom: [RenderTarget, RenderTarget] | null = null;
  private passes: {
    copy: Map<string, PassQuad>;
    copyDepth: Map<string, PassQuad>;
    composite: Map<string, PassQuad>;
    bloomPrepass: PassQuad;
    blur: [PassQuad, PassQuad];
    tone: PassQuad;
    toneUniforms: ShaderUniforms;
    /** The sky light's mipmaps made: its half from it, its quarter from its half. */
    downsample: [PassQuad, PassQuad];
    /** The impostors' materials, pass 0 and pass 1, each drawn here with a placeholder pass's textures (its program compiled ahead, and held). */
    impostors: { material: NodeMaterial; mesh: Mesh; scene: Scene }[];
    /** A pass of the bakes' kind, 1 pixel, the impostors' placeholder textures. */
    placeholder: Pass;
  } | null = null;
  private readonly bloomStep = uniform(new Vector2());
  private readonly blurSteps = [uniform(new Vector2()), uniform(new Vector2())] as const;
  private readonly bloomThreshold = uniform(0.6);
  private skyVersion = 0;
  private view: Float32Array = new Float32Array(16);
  private projection: Float32Array = new Float32Array(16);
  private yaw = 0;
  private stillDirty = true;
  private changed = true;
  private viewVersion = 0;
  private surfaces: number[][] = [];
  private surfacesKey = '';
  private beams: readonly LightAid[] = [];
  /** The editor's aids' draws by kind, made as more are wanted and kept (one of each made and compiled at the start). */
  private readonly aidPool = new Map<AidKind, { mesh: Mesh; uniforms: ShaderUniforms }[]>();
  private readonly beamGeometry: BufferGeometry;
  private readonly beamScene = new Scene();
  private readonly gpuTimesMs: number[] = [];
  /** Whether the GPU's time is measured (frame stats shown). */
  timing = false;
  /** How far the stars are streaked across the view, 0 to 1 (0: not at all). */
  streak = 0;
  /** How far the sky's layers are smeared across, as a share of the way round the sky (0: not at all). */
  smear = 0;
  /** The tint drawn over the whole picture. */
  tint: Tint = NO_TINT;
  /** The tint the picture fades from, and how far it is from it to `tint` (1: all the way). */
  fadingFrom: Tint = NO_TINT;
  fade = 1;
  private sky: SkySettings = {};
  private backdrop: Backdrop | null = null;
  private sceneLights: readonly AddedLight[] = [];
  /** Where the bodies' frames were last turned to face from: the eye, and the view's up. */
  private placedFrom?: { readonly eye: Vec3; readonly up: Vec3 };
  private cameraSet: SceneCameraSet = {};
  /**
   * The camera an anchored sky moves with (see `sky-anchors.ts`): null, the camera that draws (as
   * it is turned too); else one put where this says, over the game's.
   */
  private skyFollow: SceneCameraSet | null = null;
  /** The scene's own camera's view (its file's): where an anchored sky is for it, whatever its anchor. */
  private readonly referenceView: Float32Array;

  /** Throws when the browser has neither WebGPU nor WebGL 2. */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly loaded: LoadedPlayScene,
    /** `forceWebGL`: three.js's WebGL 2 backend even where the browser has WebGPU. */
    options: { readonly forceWebGL?: boolean } = {},
  ) {
    if (!('gpu' in navigator) && !document.createElement('canvas').getContext('webgl2'))
      throw new Error('neither WebGPU nor WebGL 2 is available');
    this.renderer = new WebGPURenderer({
      canvas,
      antialias: false,
      alpha: false,
      trackTimestamp: true,
      forceWebGL: options.forceWebGL ?? false,
    });
    this.renderer.autoClear = false;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    // Filtered: three.js's WebGPU backend leaves a nearest-filtered texture without the sampler
    // that sampling it with gradients names.
    white.minFilter = LinearFilter;
    white.magFilter = LinearFilter;
    white.needsUpdate = true;
    this.placeholder = white;
    // Each slot's own (the same white): two slots never share one, which would change the shader.
    this.slotPlaceholders = Object.fromEntries(
      SLOTS.map((slot) => {
        const t = white.clone();
        t.needsUpdate = true;
        return [slot, t];
      }),
    ) as unknown as Record<Slot, Texture>;
    const skyTarget = (size: number) => {
      const t = new RenderTarget(size, size, {
        type: UnsignedByteType,
        format: RGBAFormat,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        generateMipmaps: false,
        depthBuffer: false,
      });
      t.texture.colorSpace = NoColorSpace;
      return t;
    };
    this.skyLight = skyTarget(SKY_LIGHT_SIZE);
    this.skyLightHalf = skyTarget(SKY_LIGHT_SIZE / 2);
    this.skyLightQuarter = skyTarget(SKY_LIGHT_SIZE / 4);
    const tube = beamTube();
    this.beamGeometry = new BufferGeometry();
    this.beamGeometry.setAttribute('position', new BufferAttribute(tube, 3));
    for (const [key, image] of Object.entries(loaded.images)) this.textures.set(key, image);
    const { scene } = loaded;
    this.referenceView = viewMatrix(scene.camera.eye, scene.camera.forward, scene.camera.up);
    for (const [name, mesh] of Object.entries(scene.meshes)) {
      if (!mesh.materials.length) continue;
      if (mesh.planet) continue;
      const tube = fitTube(mesh);
      const drawn = tube ? tubeCover(tube) : mesh;
      const geometry = meshGeometry(drawn);
      for (const m of mesh.materials) {
        const material = this.material(m, name, scene.materials);
        this.sceneDraws.push({
          geometry,
          name: m,
          key: m,
          material,
          moving: moves(material),
          id: `sky:${name}:${m}`,
          ...(tube ? { tube } : {}),
        });
      }
    }
    for (const system of scene.particles) {
      const emitter = scene.meshes[system.emitter];
      if (!emitter) throw new Error(`the particles' emitter ${system.emitter} isn't in the scene`);
      const particles = new ParticleSystem(system, emitter);
      const geometry = new InstancedBufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]), 3),
      );
      geometry.setIndex([0, 1, 2, 2, 1, 3]);
      const buffer = new InstancedInterleavedBuffer(particles.instances, INSTANCE_FLOATS);
      geometry.setAttribute('particle', new InterleavedBufferAttribute(buffer, 4, 0));
      geometry.setAttribute('particleColor', new InterleavedBufferAttribute(buffer, 4, 4));
      geometry.instanceCount = 0;
      this.particles.push({
        name: system.material,
        system: particles,
        geometry,
        buffer,
        material: this.material(system.material, 'particles', scene.materials),
        gpu: null,
      });
    }
    this.placeSkyOverlays();
    this.resolveSky();
    this.renderer.init().then(
      () => {
        const backend = (this.renderer as unknown as { backend: { isWebGPUBackend?: boolean; device?: GPUDevice } }).backend;
        if (backend.isWebGPUBackend) {
          this.toClip = (clip) => vec4(clip.x, clip.y, clip.z.add(clip.w).mul(0.5), clip.w);
          // (Its pipeline first: the first images' mipmaps wait on it.)
          prepareMipmaps(backend.device!);
        }
        this.started = true;
        this.allocateAll();
        this.changed = true;
      },
      (error: unknown) => {
        this.failed = true;
        this.failure = error instanceof Error ? error.message : String(error);
        console.warn('the background scene is not drawn:', error);
      },
    );
  }

  /** Why it stopped drawing or a program failed, if one did (the renderer check reports it). */
  get failedWith(): string | null {
    return this.failure;
  }

  /** Which API it draws with, once started. */
  get backendName(): 'WebGPU' | 'WebGL 2' | null {
    if (!this.started) return null;
    const backend = (this.renderer as unknown as { backend: { isWebGPUBackend?: boolean } }).backend;
    return backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  }

  /**
   * The planets put up in the scene, replacing those there were: their textures are taken the first
   * time each planet is placed. A body put up as it was (the same placement) keeps what is worked
   * out and baked of it; only the others are worked out again.
   */
  setPlanets(placements: readonly PlanetPlacement[]): void {
    const { eye } = this.camera;
    const up = this.viewUpNow();
    let loaded = false;
    for (const placement of placements)
      for (const planet of [placement.planet, ...overlaysOf(placement)]) {
        if (this.planetsLoaded.has(planet)) continue;
        for (const [key, image] of Object.entries(planet.images))
          if (!this.textures.has(key)) {
            this.textures.set(key, image);
            loaded = true;
          }
        this.planetsLoaded.add(planet);
      }
    if (loaded) this.resolveSky();
    const previous = this.placed;
    const before = new Map(previous.map((p) => [p.placement, p]));
    const kept = new Set<Placed>();
    this.placed = placements.map((placement, i) => {
      // The same body: its placement, or (edited: a new placement) the same planet wearing the
      // same overlays at the same place in the list. Its id kept, so its draws are (`gpuOf` finds
      // them: an edit is uniforms, nothing built), and its bake shown till the next is whole.
      const at = previous[i];
      const same =
        before.get(placement) ??
        (at && at.placement.planet === placement.planet && sameOverlays(at.placement, placement) ? at : undefined);
      const keep = same && !kept.has(same) ? same : undefined;
      if (keep) kept.add(keep);
      if (keep && keep.placement === placement && !loaded) return keep;
      const placed: Placed = {
        id: keep?.id ?? nextPlacedId++,
        placement,
        frame: bodyFrame(placement.position, placement.radius, eye, up),
        extent: 0,
        states: [],
        version: keep?.version ?? 0,
        reachOf: 0,
        hasShapes: false,
        bake: keep?.bake ?? null,
      };
      this.measure(placed);
      this.resolveBody(placed);
      return placed;
    });
    for (const gone of previous) if (!kept.has(gone)) this.forget(gone);
    this.updateSurfaces();
    this.changed = true;
  }

  /** A body no longer put up: its bake and its draws' GPU sides freed. */
  private forget(placed: Placed): void {
    if (this.placed.some((p) => p.id === placed.id)) return;
    this.freeBake(placed.bake);
    for (const [key, gpu] of this.gpuDraws)
      if (key.startsWith(`body:${placed.id}:`)) {
        this.release(gpu);
        this.gpuDraws.delete(key);
      }
    this.bodyScenes.delete(placed.id);
  }

  private measure(placed: Placed): void {
    const { position, radius } = placed.placement;
    const parts = partsOf(placed.placement);
    placed.extent = partsExtent(radius, parts, distance(position, this.camera.eye));
    placed.reachOf = reach(parts) * radius;
    placed.hasShapes = parts.some((p) => p.shape.kind !== 'sphere' && p.shape.kind !== 'ring');
  }

  private resolveBody(placed: Placed): void {
    const { planet } = placed.placement;
    const overlays = overlaysOf(placed.placement);
    const light = overlays.find((o) => o.planet.light)?.planet.light ?? planet.planet.light;
    const draws: MeshDraw[] = [];
    for (const loaded of [planet, ...overlays]) {
      const own = loaded === planet;
      const parts = own ? loaded.planet.parts : overlayParts(placed.placement, loaded);
      parts.forEach((part, i) => {
        for (const m of part.materials) {
          const material = this.material(m, `${loaded.id}/${i}`, loaded.planet.materials);
          const overlay = own ? undefined : overlayOfFile(loaded.id);
          const partKey = own ? ownPartKey(part) : overlayPartKey(overlayOfFile(loaded.id), part);
          draws.push({
            name: m,
            key: materialKey(m, overlay),
            ...(overlay ? { overlay } : {}),
            material,
            moving: moves(material),
            placed,
            owner: loaded,
            part,
            partKey,
            light,
            id: `body:${placed.id}:${loaded.id}:${i}:${m}`,
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

  private resolveSky(): void {
    const states = [...this.sceneDraws, ...this.skyOverlayDraws].map((d) => this.resolve(d));
    this.skyStates = sorted(states, () => this.sky.order);
    this.skyMoves = this.skyStates.some((s) => s.enabled && s.moving);
    this.particlesShown = this.particles.some((p) => this.sky.materials?.[p.name]?.enabled ?? MATERIAL_DEFAULTS.enabled);
    const signature = JSON.stringify([this.skyStates.map((s) => s.signature), this.sky.tint ?? null, this.textures.size]);
    if (signature !== this.skySignature) {
      this.skySignature = signature;
      this.stillDirty = true;
    }
    this.changed = true;
  }

  /**
   * A draw worked out: its settings, its material as set, how it is lit, its uniforms (its GPU side
   * is found or made as it is drawn).
   */
  private resolve(draw: MeshDraw): DrawState {
    const settings = this.settingsOf(draw);
    const has = (texture: string) => this.textures.has(texture);
    const layered = withLayers(withMasks(draw.material, settings?.masks), settings?.layers, has);
    const placement = draw.placed?.placement;
    const unshaded =
      !!draw.part &&
      (draw.part.pattern?.kind === 'hex' ||
        (settings?.lit !== undefined ? !settings.lit : layered.unshaded) ||
        (!draw.light && !addedLighting(this.addedTo(placement), placement?.lights)));
    const material = draw.part && unshaded !== layered.unshaded ? { ...layered, unshaded } : layered;
    const moving = draw.moving || (material !== draw.material && moves(material));
    const blend = settings?.blend ?? draw.material.blend;
    const enabled = (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) && shown(draw);
    const anchor: SkyAnchor = draw.placed ? 'world' : skyAnchorOf(settings, this.sky.anchor);
    const depth = this.depthOf(draw.name, settings, !!draw.placed);
    const scale = settings?.scale ?? MATERIAL_DEFAULTS.scale;
    const u = new UniformSet();
    materialUniforms(u, material, scale, blend, (layer) => !!layer.texture && has(layer.texture), settings?.spreadFrom);
    u.f1('uGlowBoost', settings?.glow ?? MATERIAL_DEFAULTS.glow);
    u.f1('uSpread', settings?.spread ?? -1);
    u.f1('uFalloff', settings?.falloff ?? MATERIAL_DEFAULTS.falloff);
    u.f1('uCut', settings?.cut ?? MATERIAL_DEFAULTS.cut);
    u.f1('uStrength', settings?.strength ?? MATERIAL_DEFAULTS.strength);
    tintUniforms(u, 'uTint', settings?.tint);
    const base = { draw, enabled, depth, anchor, blend, moving, material, uniforms: u, scrolls: scrollingLayers(material) };
    if (!draw.part || !draw.placed || !placement) {
      const tube = draw.tube;
      u.i1('uTube', tube ? 1 : 0);
      if (tube) {
        u.f4('uTubeShape', tube.centre[0], tube.centre[1], tube.radius, 0);
        u.f4('uTubeMap', ...tube.u, ...tube.v);
        u.f2('uTubeSpan', tube.low, tube.high);
      }
      return { ...base, signature: JSON.stringify([draw.key, settings ?? null, blend, depth, anchor, enabled]) };
    }
    const part = withPart(draw.part, draw.partKey && placement.parts?.[draw.partKey]);
    partUniforms(u, part);
    const tuning = placement.planet.planet.tuning;
    const rig = material.unshaded ? undefined : draw.light;
    const turned = rig && tunedRig(rig, placement.lighting ?? tuning?.lighting, placement.lightFrom ?? tuning?.lightFrom);
    const added = this.addedTo(placement);
    const linked = linkedSettings(placement.lights, added, draw.partKey, draw.key);
    const shade = this.shadeOf(placement);
    const exposure = this.loaded.scene.tone.exposure;
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
    const darkenings = bodyDarkenings(
      draw.light && tunedRig(draw.light, placement.lighting ?? tuning?.lighting, placement.lightFrom ?? tuning?.lightFrom),
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
    const own = worn.length ? worn.find((o) => o.planet.light)?.planet.light : placement.planet.planet.light;
    u.f1('uGlowThreshold', own?.bloomThreshold ?? this.sceneThreshold());
    const pattern = draw.part.pattern;
    const drawn = pattern?.kind === 'hex' && settings?.drawAs !== 'texture';
    const round = pattern?.across ? pattern.across * (material.emissive?.tiling?.[0] ?? 1) : HEX_ROUND;
    u.i1('uPattern', drawn ? 1 : 0);
    u.f3('uPatternParams', round / scale, settings?.width ?? MATERIAL_DEFAULTS.width, settings?.soft ?? MATERIAL_DEFAULTS.soft);
    return { ...base, part, signature: '' };
  }

  // --- The GPU side of draws ----------------------------------------------------------------

  /** An image's mipmaps on WebGPU (see `mips`): made the first time they are asked for, null till then. */
  private mipsOf(key: string, image: ImageBitmap): ImageBitmap[] | null | false {
    const made = this.mips.get(key);
    if (made !== undefined) return made;
    this.mips.set(key, null);
    const { device } = (this.renderer as unknown as { backend: { device: GPUDevice } }).backend;
    mipChain(device, image).then(
      (chain) => {
        this.mips.set(key, chain);
        this.changed = true;
      },
      (error: unknown) => {
        // (Its draws not held up: three.js makes its mipmaps, as it would have; the check reports it.)
        this.mips.set(key, false);
        this.changed = true;
        this.failure ??= `an image's mipmaps weren't made: ${error instanceof Error ? error.message : String(error)}`;
        console.warn('a background image has no ready-made mipmaps:', error);
      },
    );
    return null;
  }

  /**
   * A texture as a layer samples it: its image, repeating or not each way, with its mipmaps; null
   * while they are being made.
   */
  private sampledTexture(key: string | undefined, wrap: readonly [boolean, boolean] | undefined): Texture | null {
    const image = key ? this.textures.get(key) : undefined;
    if (!key || !image) return this.placeholder;
    const mipmaps = this.backendName === 'WebGPU' ? this.mipsOf(key, image) : undefined;
    if (mipmaps === null) return null;
    const [wu, wv] = wrap ?? [true, true];
    const id = `${key}:${wu}:${wv}`;
    let t = this.sampled.get(id);
    if (!t) {
      t = new Texture(image);
      t.flipY = false;
      t.premultiplyAlpha = false;
      t.colorSpace = NoColorSpace;
      if (mipmaps) {
        // (ImageBitmaps, which three.js uploads as it does canvases: its types name only those.)
        t.mipmaps = mipmaps as unknown as HTMLCanvasElement[];
        t.generateMipmaps = false;
      } else t.generateMipmaps = true;
      t.minFilter = LinearMipmapLinearFilter;
      t.magFilter = LinearFilter;
      t.wrapS = wu ? RepeatWrapping : ClampToEdgeWrapping;
      t.wrapT = wv ? RepeatWrapping : ClampToEdgeWrapping;
      t.needsUpdate = true;
      this.sampled.set(id, t);
    }
    return t;
  }

  /** A state's textures, in the shader's slots (a slot's own placeholder where it has none); null while any's mipmaps are being made. */
  private texturesOf(s: DrawState): Record<Slot, Texture> | null {
    const layers = layersOf(s.material);
    const textures = SLOTS.map((_, i) => this.sampledTexture(layers[i]?.texture, layers[i]?.wrap));
    if (textures.includes(null)) return null;
    return Object.fromEntries(
      SLOTS.map((slot, i) => [slot, textures[i] === this.placeholder ? this.slotPlaceholders[slot] : textures[i]!]),
    ) as Record<Slot, Texture>;
  }

  /**
   * A state's GPU side: the one kept for its draw if it was made for the same kind of draw, blend,
   * depth and textures (its values then the state's), else one made anew, with its kind's shared
   * material, whose program is compiled (see `keepers`). None while its textures' mipmaps are
   * being made.
   */
  private gpuOf(s: DrawState): GpuDraw | null {
    if (!this.started) return null;
    const body = !!s.part;
    const textures = this.texturesOf(s);
    if (!textures) return null;
    const key = JSON.stringify([body ? 'body' : 'mesh', s.blend, s.depth, SLOTS.map((slot) => textures[slot].uuid)]);
    let gpu = this.gpuDraws.get(s.draw.id);
    if (!gpu || gpu.key !== key) {
      const old = gpu;
      const scene = s.draw.placed ? this.bodyScene(s.draw.placed) : this.skyScene;
      gpu = this.drawOf(key, body, s.blend, s.depth, textures, s.draw.geometry ?? this.square, scene);
      if (old) {
        // (Out of the scene now; its material kept till this one is ready, holding its pipeline.)
        old.mesh.removeFromParent();
        if (old.replaces) this.release(old.replaces);
        gpu.replaces = old;
      }
      this.gpuDraws.set(s.draw.id, gpu);
    }
    gpu.uniforms.apply(s.uniforms);
    return gpu;
  }

  /** A draw's GPU side made: its own mesh and values, its kind's shared material, in a scene, its compile asked for. */
  private drawOf(
    key: string,
    body: boolean,
    blend: SceneBlend,
    depth: MaterialDepth,
    textures: Readonly<Record<Slot, Texture>>,
    geometry: BufferGeometry,
    scene: Scene,
  ): GpuDraw {
    const uniforms = new DrawValues(textures);
    const mesh = withValues(new Mesh(geometry, this.sharedMaterial(body, blend, depth)), uniforms);
    mesh.frustumCulled = false;
    mesh.visible = false; // shown only as it is drawn
    scene.add(mesh);
    this.requestCompile();
    return { key, mesh, uniforms, ready: false, state: body ? 'body' : 'mesh' };
  }

  /**
   * A kind of draw's material (a body's part's, or a sky mesh's) for a blend and depth, made the
   * first time and kept: its shader reads each draw's values and textures as it draws it (see
   * `ShaderUniforms`), so it is built once, whatever draws it has.
   */
  private sharedMaterial(body: boolean, blend: SceneBlend, depth: MaterialDepth): NodeMaterial {
    const key = sharedKey(body, blend, depth);
    const tested = body || depth === 'scene';
    let material = this.sharedMaterials.get(key);
    if (material) return material;
    const uniforms = new ShaderUniforms(true);
    const slots = new TextureSlots(uniforms, this.slotPlaceholders, this.skyLightQuarter.texture);
    material = new NodeMaterial();
    const nodes = (body ? bodyNodes : meshNodes)(uniforms, slots, this.toClip);
    material.vertexNode = nodes.vertex;
    material.fragmentNode = nodes.fragment;
    setBlend(material, blend);
    if (!body) material.side = FrontSide;
    material.depthTest = tested;
    material.depthWrite = blend === 'opaque' && tested;
    // (Its kind, blend and depth, as three.js names its pipelines: the renderer check lists them.)
    material.name = `${body ? 'body' : 'skyMesh'}:${blend}${tested ? '' : ':flat'}`;
    material.userData['shared'] = true;
    coldVertex(material);
    this.sharedMaterials.set(key, material);
    return material;
  }

  private bodyScene(placed: Placed): Scene {
    let scene = this.bodyScenes.get(placed.id);
    if (!scene) this.bodyScenes.set(placed.id, (scene = new Scene()));
    return scene;
  }

  /**
   * The programs not compiled yet compiled soon: every draw made in the same task (a frame, a set of
   * planets) asked for together, after it, so they all compile side by side.
   */
  private requestCompile(): void {
    if (this.compileAsked) return;
    this.compileAsked = true;
    queueMicrotask(() => {
      this.compileAsked = false;
      this.compileWaiting();
    });
  }

  /** The materials three.js has built the shader of (a draw of theirs compiled), and those whose first compile is under way. */
  private readonly built = new WeakSet<Material>();
  private readonly building = new WeakSet<Material>();

  /**
   * Every draw whose program isn't compiled (or compiling) compiled in the background, each on its
   * own (three.js compiles a scene's meshes one after another), all at once, for the target it
   * draws into (the frame's: the bakes and still targets are alike); each draw ready as its own is.
   * A material's first compile goes on its own (its keeper's, where it has one): three.js builds
   * the shader again for each of its draws compiled before a build is done, and keeps only the
   * last (so letting go of one of the others would let go of it); its other draws follow, and find
   * it built.
   */
  private compileWaiting(): void {
    if (!this.frame) return;
    const first = new Set<Material>();
    const waiting = [
      ...this.keepers.values(),
      ...this.gpuDraws.values(),
      ...this.particles.flatMap((p) => (p.gpu ? [p.gpu] : [])),
    ].filter((g) => {
      if (g.ready || g.compiling) return false;
      const material = g.mesh.material as Material;
      if (this.built.has(material)) return true;
      if (this.building.has(material) || first.has(material)) return false;
      first.add(material);
      return true;
    });
    if (!waiting.length) return;
    this.compiling++;
    const compiled = waiting.map((g) => {
      g.compiling = true;
      const material = g.mesh.material as Material;
      if (first.has(material)) this.building.add(material);
      // A draw is ready once every compile of its kind's shader in flight is done: three.js shares
      // programs and pipelines between draws of one shader (on WebGL one program serves every
      // blend), and a draw's compile finds one still building as done at once (drawn then, it
      // would be left out: its bake empty).
      const flight = this.inFlight.get(g.state) ?? { count: 0, done: [] };
      flight.count++;
      this.inFlight.set(g.state, flight);
      // (Only what is visible is compiled: shown while its compile starts, which reads it at once.)
      const shown = g.mesh.visible;
      g.mesh.visible = true;
      const done = this.compileFor(g.mesh, this.frame!.colour, g.mesh.parent as Scene | null);
      g.mesh.visible = shown;
      const settle = () => {
        if (this.building.has(material)) {
          // (Its shader built: its draws left waiting compile now.)
          this.building.delete(material);
          this.built.add(material);
          this.requestCompile();
        }
        flight.done.push(g);
        if (--flight.count > 0) return;
        for (const d of flight.done) {
          d.ready = true;
          d.compiling = false;
          if (d.dropped) freeGpu(d);
          if (d.replaces) {
            this.release(d.replaces);
            d.replaces = undefined;
          }
        }
        this.inFlight.delete(g.state);
        this.changed = true;
      };
      return done.then(settle, (error: unknown) => {
        settle();
        throw error;
      });
    });
    void Promise.all(compiled).then(
      () => {
        this.compiling--;
        this.changed = true;
      },
      (error: unknown) => {
        this.compiling--;
        this.failure ??= `a program failed to compile: ${error instanceof Error ? error.message : String(error)}`;
        console.warn('a background program failed to compile:', error);
      },
    );
  }

  /**
   * An object's programs compiled ahead for a target, as drawing it there would: three.js's
   * compile takes the renderer's own depth setting for the target's, so it is set to the target's
   * (else a target with no depth gets a pipeline with one, and drawing makes another at once).
   */
  private compileFor(object: Mesh, target: RenderTarget | null, scene: Scene | null = null): Promise<void> {
    const r = this.renderer;
    const depth = r.depth;
    r.depth = target ? target.depthBuffer : depth;
    r.setRenderTarget(target);
    const done = scene ? r.compileAsync(object, this.camera3, scene) : r.compileAsync(object, (object as PassQuad).camera ?? this.camera3);
    r.setRenderTarget(null);
    r.depth = depth;
    return done.then(() => undefined);
  }

  /**
   * Every draw the first picture has, made at once (its programs then all compiled side by side,
   * with the passes'): the sky's, the bodies' up and the particles' (those whose textures are
   * ready), and the keepers (every program they need, ready or not).
   */
  private makeDraws(): void {
    for (const blend of BLEND_KINDS) this.keep(true, blend, 'scene', this.square);
    for (const s of this.skyStates) if (s.enabled) this.keep(false, s.blend, s.depth, s.draw.geometry ?? this.square);
    for (const s of this.skyStates) if (s.enabled) this.gpuOf(s);
    for (const body of this.placed) for (const s of body.states) if (s.enabled && s.part) this.gpuOf(s);
    for (const p of this.particles) this.particleGpu(p, this.depthOf(p.name, this.sky.materials?.[p.name], false));
  }

  /** A shared material's keeper (see `keepers`), made where it has none: drawn with a geometry like its draws'. */
  private keep(body: boolean, blend: SceneBlend, depth: MaterialDepth, geometry: BufferGeometry): void {
    const key = sharedKey(body, blend, depth);
    if (this.keepers.has(key)) return;
    this.keepers.set(key, this.drawOf(`keeper:${key}`, body, blend, depth, this.slotPlaceholders, geometry, this.keeperScene));
  }

  /** The sky's GPU draws, each state's (made where missing); null while any isn't compiled yet. */
  private skyReady(): boolean {
    let ready = true;
    for (const s of this.skyStates) {
      if (!s.enabled) continue;
      const g = this.gpuOf(s);
      if (!g?.ready) ready = false;
    }
    return ready;
  }

  // --- Picking and placing -------------------------------------------------------------------

  /**
   * The placed planet under a point of the view (`x`, `y`: shares of its width and height; the
   * view `aspect` wide), by its index in what was put up (`setPlanets`); the nearest where they
   * overlap; null where there is none. Its body counts, not its halo.
   */
  pick(x: number, y: number, aspect: number): number | null {
    const m = multiply(this.projection, this.view);
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

  /**
   * Where each placed planet shows in the view, for labels: its centre (`x`, `y`) and its top
   * (`top`), as shares of the view's width and height from the top left; none for one behind the eye.
   */
  anchors(): { id: string; x: number; y: number; top: number }[] {
    const m = multiply(this.projection, this.view);
    const project = (p: Vec3): [number, number] | null => {
      const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
      if (w <= 0) return null;
      const x = (m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!) / w;
      const y = (m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!) / w;
      return [(x + 1) / 2, (1 - y) / 2];
    };
    const out: { id: string; x: number; y: number; top: number }[] = [];
    for (const { placement, frame } of this.placed) {
      const { position, radius } = placement;
      const centre = project(position);
      // Its top as drawn: up its frame (turned to the view's up), not the world's.
      const z = frame.axes.subarray(6, 9);
      const top = project([position[0] + z[0]! * radius, position[1] + z[1]! * radius, position[2] + z[2]! * radius]);
      if (centre && top) out.push({ id: placement.planet.label ?? placement.planet.id, x: centre[0], y: centre[1], top: top[1] });
    }
    return out;
  }

  /** The placed planets moved: their positions and radii, in the order they were placed. */
  placePlanets(positions: readonly Vec3[], radii?: readonly number[]): void {
    const { eye } = this.camera;
    const up = this.viewUpNow();
    // The eye moved or the view turned: every body faces it anew.
    const from = this.placedFrom;
    const seen = from?.eye === eye && from.up.every((v, k) => v === up[k]);
    this.placed.forEach((placed, i) => {
      const position = positions[i] ?? placed.placement.position;
      const radius = radii?.[i] ?? placed.placement.radius;
      const was = placed.placement;
      if (position === was.position && radius === was.radius && seen) return;
      placed.placement = { ...was, position, radius };
      placed.frame = bodyFrame(position, radius, eye, up);
      this.measure(placed);
      placed.version++;
    });
    this.placedFrom = { eye, up };
    this.updateSurfaces();
    this.changed = true;
  }

  private get camera(): SceneCamera {
    return { ...this.loaded.scene.camera, ...this.cameraSet };
  }

  /**
   * The camera put where a scene says (none set: the game's): everything seen from there (the
   * planets' faces turned to it; the sky as its anchors put it), drawn again.
   */
  setCamera(set: SceneCameraSet | undefined): void {
    const next = set ?? {};
    if (JSON.stringify(next) === JSON.stringify(this.cameraSet)) return;
    this.cameraSet = next;
    this.view = this.viewNow();
    this.projection = this.projectionNow();
    this.placedFrom = undefined;
    this.placePlanets(this.placed.map((p) => p.placement.position));
    this.stillDirty = true;
    this.viewChanged();
  }

  /** The camera turned about its up from where the scene puts it, in radians. */
  setYaw(yaw: number): void {
    if (yaw === this.yaw) return;
    this.yaw = yaw;
    this.view = this.viewNow();
    this.placePlanets(this.placed.map((p) => p.placement.position)); // turned with the view
    this.stillDirty = true;
    this.viewChanged();
  }

  private viewChanged(): void {
    this.viewVersion++;
    this.changed = true;
  }

  private projectionNow(): Float32Array {
    const camera = this.camera;
    return projectionMatrix(camera.fovY, this.canvas.width / this.canvas.height, camera.near, Infinity);
  }

  private viewNow(): Float32Array {
    const camera = this.camera;
    return viewMatrix(camera.eye, turnAbout(camera.forward, camera.up, this.yaw), camera.up);
  }

  /** Up on the screen as the view (`viewNow`) has it: what the bodies' frames are turned to. */
  private viewUpNow(): Vec3 {
    const camera = this.camera;
    return viewUp({ forward: turnAbout(camera.forward, camera.up, this.yaw), up: camera.up });
  }

  /**
   * The drawing buffer's size, in device pixels; the camera keeps its vertical field of view. What
   * doesn't move is drawn again at the new size.
   */
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.canvas.width = w;
    this.canvas.height = h;
    this.renderer.setSize(w, h, false);
    this.view = this.viewNow();
    this.projection = this.projectionNow();
    if (this.started) this.allocateAll();
    this.stillDirty = true;
    this.viewChanged();
  }

  // --- Targets and passes ---------------------------------------------------------------------

  private newPass(width: number, height: number): Pass {
    return { colour: floatTarget(width, height), glow: floatTarget(width, height) };
  }

  private freePass(pass: Pass | null): void {
    if (!pass) return;
    const impostors = this.bakeImpostors.get(pass);
    if (impostors) {
      for (const draw of [...impostors.colour, ...impostors.glow]) freeGpu(draw);
      this.bakeImpostors.delete(pass);
    }
    for (const t of [pass.colour, pass.glow]) {
      t.depthTexture?.dispose();
      t.dispose();
    }
  }

  /**
   * The canvas-sized targets and the bloom's, sized to the canvas: made the first time, with the
   * passes that read them; resized in place after (the passes keep their materials, compiled: new
   * ones would not have their programs on the frame drawn straight after a resize).
   */
  private allocateAll(): void {
    const { width, height } = this.canvas;
    const bw = Math.max(1, Math.ceil(width / BLOOM_SCALE));
    const bh = Math.max(1, Math.ceil(height / BLOOM_SCALE));
    if (this.passes && this.stillBackground && this.stillScene && this.frame && this.bloom) {
      for (const pass of [this.stillBackground, this.stillScene, this.frame])
        for (const t of [pass.colour, pass.glow]) {
          t.setSize(width, height);
          if (t.depthTexture) {
            t.depthTexture.image.width = width;
            t.depthTexture.image.height = height;
            t.depthTexture.needsUpdate = true;
          }
        }
      for (const t of this.bloom) t.setSize(bw, bh);
      this.bloomStep.value.set(1 / width, 1 / height);
      return;
    }
    this.stillBackground = this.newPass(width, height);
    this.stillScene = this.newPass(width, height);
    this.frame = this.newPass(width, height);
    const bloomTarget = () => {
      const t = new RenderTarget(bw, bh, {
        type: HalfFloatType,
        format: RGBAFormat,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        generateMipmaps: false,
        depthBuffer: false,
      });
      t.texture.colorSpace = NoColorSpace;
      return t;
    };
    this.bloom = [bloomTarget(), bloomTarget()];
    const frame = this.frame;
    const quad = (m: NodeMaterial) => new PassQuad(m);
    const byOutput = (make: (o: Output) => NodeMaterial) =>
      new Map(OUTPUTS.map((o) => [o, quad(make(o))] as const));
    const of = (pass: Pass, o: Output) => (o === 'glow' ? pass.glow : pass.colour);
    const still = { background: this.stillBackground, scene: this.stillScene };
    const toneUniforms = new ShaderUniforms();
    this.passes = {
      copy: byOutput((o) => copyMaterial(of(still.background, o).texture)),
      copyDepth: byOutput((o) => copyDepthMaterial(of(still.scene, o).depthTexture!)),
      composite: new Map([
        ...OUTPUTS.map((o) => [`scene:${o}`, quad(compositeMaterial(of(still.scene, o).texture, true))] as const),
        ['skyBackground', quad(compositeMaterial(still.background.colour.texture, false))],
        ['skyScene', quad(compositeMaterial(still.scene.colour.texture, false))],
      ]),
      bloomPrepass: quad(bloomPrepassMaterial(frame.colour.texture, frame.glow.texture, this.bloomStep, this.bloomThreshold)),
      blur: [quad(bloomBlurMaterial(this.bloom[0].texture, this.blurSteps[0])), quad(bloomBlurMaterial(this.bloom[1].texture, this.blurSteps[1]))],
      tone: quad(toneMaterial(toneUniforms, frame.colour.texture, this.bloom[0].texture)),
      toneUniforms,
      downsample: [quad(downsampleMaterial(this.skyLight.texture)), quad(downsampleMaterial(this.skyLightHalf.texture))],
      impostors: [],
      placeholder: this.newPass(1, 1),
    };
    const placeholder = this.passes.placeholder.colour;
    this.passes.impostors = ([0, 1] as const).map((pass) => {
      const material = impostorMaterial(new ShaderUniforms(true), placeholder.texture, placeholder.depthTexture!, pass, this.toClip);
      material.userData['shared'] = true;
      const mesh = withValues(new Mesh(this.square, material), new DrawValues());
      mesh.frustumCulled = false;
      const scene = new Scene();
      scene.add(mesh);
      return { material, mesh, scene };
    });
    this.bloomStep.value.set(1 / width, 1 / height);
    this.compilePasses();
  }

  /** Whether a picture has been drawn (see `draw`). */
  private drawnOnce = false;

  /** Whether the passes' programs have compiled (nothing is drawn until they have). */
  private passesReady = false;
  /** Whether the editor's aids' programs are asked for, and whether they have compiled (none is drawn until they have: see `compileAids`). */
  private aidsAsked = false;
  private aidsReady = false;

  /**
   * One of each of the editor's aids (drawn over the picture, in the canvas) compiled once the
   * whole picture is up (none is wanted before it, and compiled with the rest they would hold the
   * picture up: WebGPU builds pipelines only so many at a time), so one shown later has its
   * program at once.
   */
  private compileAids(): void {
    const compiled = (['outline', 'light', 'dark', 'edge'] as const).map((kind) => {
      const scene = new Scene();
      const { mesh } = this.aid(kind, 0);
      scene.add(mesh);
      return this.compileFor(mesh, null, scene).then(() => void scene.clear());
    });
    void Promise.all(compiled).then(
      () => {
        this.aidsReady = true;
        this.changed = true;
      },
      (error: unknown) => {
        this.failure ??= `an editing aid's program failed to compile: ${error instanceof Error ? error.message : String(error)}`;
        console.warn("an editing aid's program failed to compile:", error);
      },
    );
  }

  /**
   * The passes' programs compiled in the background, each for the target it draws into (as it
   * draws there: see `compileFor`), and with them every draw the first picture has (`makeDraws`):
   * all side by side.
   */
  private compilePasses(): void {
    const p = this.passes!;
    const frame = this.frame!;
    const into: [PassQuad, RenderTarget | null][] = [
      ...OUTPUTS.flatMap((o) => [
        [p.copy.get(o)!, this.target(frame, o)] as [PassQuad, RenderTarget],
        [p.copyDepth.get(o)!, this.target(frame, o)] as [PassQuad, RenderTarget],
        [p.composite.get(`scene:${o}`)!, this.target(frame, o)] as [PassQuad, RenderTarget],
      ]),
      [p.composite.get('skyBackground')!, this.skyLight],
      [p.composite.get('skyScene')!, this.skyLight],
      [p.downsample[0], this.skyLightHalf],
      [p.downsample[1], this.skyLightQuarter],
      [p.bloomPrepass, this.bloom![0]],
      [p.blur[0], this.bloom![1]],
      [p.blur[1], this.bloom![0]],
      [p.tone, null],
    ];
    const compiled = into.map(([quad, target]) => this.compileFor(quad, target));
    for (const { mesh, scene } of p.impostors)
      for (const o of OUTPUTS) compiled.push(this.compileFor(mesh, this.target(frame, o), scene));
    void Promise.all(compiled).then(
      () => {
        this.passesReady = true;
        this.changed = true;
      },
      (error: unknown) => {
        this.failed = true;
        this.failure = error instanceof Error ? error.message : String(error);
        console.warn('the background scene is not drawn:', error);
      },
    );
    this.makeDraws();
  }

  private sceneThreshold(): number {
    return this.loaded.scene.tone.bloomThreshold ?? DEFAULT_BLOOM_THRESHOLD;
  }

  private target(pass: Pass, output: Output): RenderTarget {
    return output === 'glow' ? pass.glow : pass.colour;
  }

  /** A target cleared to black, covering as far as `alpha` says, its depth to the farthest. */
  private clear(target: RenderTarget, alpha: number): void {
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, alpha);
    this.renderer.clear(true, true, false);
  }

  private drawStill(): void {
    const background = this.stillBackground!;
    const scene = this.stillScene!;
    for (const output of OUTPUTS) {
      this.clear(this.target(background, output), this.backdrop ? 0 : 1);
      this.drawMeshes(0, 'background', output, false);
      this.clear(this.target(scene, output), 0);
      this.drawMeshes(0, 'scene', output, false);
    }
    this.clear(this.skyLight, 0);
    this.passes!.composite.get('skyBackground')!.render(this.renderer);
    this.passes!.composite.get('skyScene')!.render(this.renderer);
    // Its mipmaps one and two (the bodies' sky lights read the second).
    this.renderer.setRenderTarget(this.skyLightHalf);
    this.passes!.downsample[0].render(this.renderer);
    this.renderer.setRenderTarget(this.skyLightQuarter);
    this.passes!.downsample[1].render(this.renderer);
    this.skyVersion++;
    // (A still draw being made again, or waiting on its textures, was left out: drawn again once it is ready.)
    this.stillDirty = this.skyStates.some((s) => s.enabled && !s.moving && !this.gpuOf(s)?.ready);
  }

  // --- Settings --------------------------------------------------------------------------------

  /**
   * Where a draw is drawn among the scene's objects: a body's among them; a sky material's as set,
   * else as the data puts it, never among them where it isn't anchored to the world.
   */
  private depthOf(name: string, settings: MaterialSettings | undefined, placed: boolean): MaterialDepth {
    if (placed) return 'scene';
    const depth = settings?.depth ?? skyDepths(this.loaded.scene)[name] ?? 'background';
    return anchoredDepth(depth, skyAnchorOf(settings, this.sky.anchor));
  }

  /** Whether any of the sky shown moves with the camera (a mesh or a particle system not anchored to the world). */
  private skyAnchored(): boolean {
    return (
      this.skyStates.some((s) => s.enabled && s.anchor !== 'world') ||
      this.particles.some((p) => {
        const settings = this.sky.materials?.[p.name];
        return (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) && skyAnchorOf(settings, this.sky.anchor) !== 'world';
      })
    );
  }

  /**
   * The view a sky draw anchored so is seen through (see `anchoredView`): the camera's own for one
   * fixed in the world; else as the followed camera moves it.
   */
  private skyView(anchor: SkyAnchor): Float32Array {
    if (anchor === 'world') return this.view;
    return anchoredView(anchor, this.view, this.followView(), this.referenceView);
  }

  /** The followed camera's view: the camera that draws (turned as it is), or the one set, over the game's. */
  private followView(): Float32Array {
    if (!this.skyFollow) return this.view;
    const camera = { ...this.loaded.scene.camera, ...this.skyFollow };
    return viewMatrix(camera.eye, camera.forward, camera.up);
  }

  /**
   * The camera an anchored sky moves with: null, the camera that draws; else one put where this
   * says, over the game's (the editor's view of the sky from outside). What doesn't move of the sky
   * is drawn again where any of it is anchored.
   */
  setSkyFollow(set: SceneCameraSet | null): void {
    if (JSON.stringify(set) === JSON.stringify(this.skyFollow)) return;
    this.skyFollow = set;
    if (this.skyStates.some((s) => s.enabled && !s.moving && s.anchor !== 'world')) this.stillDirty = true;
    if (this.skyAnchored()) this.changed = true;
  }

  /** An editing backdrop shown in place of the sky (null: the sky again). */
  setBackdrop(backdrop: Backdrop | null): void {
    if (JSON.stringify(backdrop) === JSON.stringify(this.backdrop)) return;
    this.backdrop = backdrop;
    this.stillDirty = true;
    this.changed = true;
  }

  /** The scene's lights, lighting every planet as its own added ones do: each body worked out again. */
  setSceneLights(lights: readonly AddedLight[]): void {
    if (JSON.stringify(lights) === JSON.stringify(this.sceneLights)) return;
    this.sceneLights = lights;
    for (const placed of this.placed) this.resolveBody(placed);
    this.changed = true;
  }

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

  private placeSkyOverlays(): void {
    const scene = this.loaded.scene;
    const worn: { id: string; file: SkyOverlayFile; images?: Readonly<Record<string, ImageBitmap>> }[] = [
      ...(this.sky.own ? [{ id: '', ...this.sky.own }] : []),
      ...(this.sky.overlays ?? scene.wears ?? []).flatMap((id) => {
        const made = this.sky.made?.[id];
        const file = made?.file ?? scene.overlays?.[id];
        return file ? [{ id, file, images: made?.images }] : [];
      }),
    ];
    const key = JSON.stringify([worn.map(({ id, file }) => [id, fileId(file)]), this.sky.parts ?? null]);
    if (key === this.skyOverlayKey) return;
    this.skyOverlayKey = key;
    const oldGeometries = this.skyOverlayGeometries;
    const oldDraws = this.skyOverlayDraws;
    this.skyOverlayGeometries = [];
    this.skyOverlayDraws = [];
    for (const { images } of worn)
      for (const [textureKey, image] of Object.entries(images ?? {}))
        if (!this.textures.has(textureKey)) this.textures.set(textureKey, image);
    const files = new Map(worn.map((w) => [w.id, w.file]));
    // Placed about the scene's own camera, as the sky's meshes are where they are for it; then
    // anchored as the rest of the sky is.
    for (const part of skyOverlayParts(worn, this.sky.parts, scene.camera)) {
      const file = files.get(overlayOfPartKey(part.key) ?? '');
      if (!file) continue;
      const geometry = meshGeometry({ ...part.mesh, materials: part.materials });
      this.skyOverlayGeometries.push(geometry);
      part.materials.forEach((m, i) => {
        if (!file.materials[m]) return;
        const material = this.material(m, part.key, file.materials);
        const overlay = overlayOfPartKey(part.key);
        this.skyOverlayDraws.push({
          geometry,
          name: m,
          key: materialKey(m, overlay),
          ...(overlay ? { overlay } : {}),
          material,
          moving: moves(material),
          // (Each part's material the same draw however the overlays are placed: its GPU side kept.)
          id: `overlay:${part.key}:${i}:${m}`,
        });
      });
    }
    // The draws kept (a part's setting changed): their meshes given the new
    // geometry, nothing built; the draws gone let go of; the old geometry after.
    const ids = new Set(this.skyOverlayDraws.map((d) => d.id));
    for (const d of this.skyOverlayDraws) {
      const gpu = this.gpuDraws.get(d.id);
      if (gpu && d.geometry) gpu.mesh.geometry = d.geometry;
    }
    for (const d of oldDraws) if (!ids.has(d.id)) this.dropGpu(d.id);
    for (const g of oldGeometries) g.dispose();
  }

  private dropGpu(id: string): void {
    const gpu = this.gpuDraws.get(id);
    if (!gpu) return;
    this.release(gpu);
    this.gpuDraws.delete(id);
  }

  /**
   * A draw let go of: out of its scene now, freed once its compile is done (freed while three.js
   * builds it, its build would go on and leak).
   */
  private release(gpu: Releasable): void {
    gpu.mesh.removeFromParent();
    if (gpu.compiling) gpu.dropped = true;
    else freeGpu(gpu);
  }

  /**
   * Whether a frame drawn at `seconds` would differ from the last: something has changed, three.js
   * is still starting or a program compiling, the sky moves (its scrolling layers, its particles),
   * or a body's scrolling layers have moved far enough to bake it again.
   */
  needsFrame(seconds: number): boolean {
    if (this.failed) return false;
    if (!this.started || this.changed || this.stillDirty || !this.skyReady()) return true;
    if (!this.backdrop && (this.skyMoves || this.particlesShown)) return true;
    return this.placed.some((b) => this.bakeDue(b, seconds));
  }

  /** The GPU's times for the frames drawn since last asked (ms), where it can be timed. */
  gpuTimes(): number[] {
    return this.gpuTimesMs.splice(0);
  }

  /** How many bodies are up (not hidden), and how many of them are baked whole (the renderer check). */
  bodyCounts(): { placed: number; baked: number } {
    const up = this.placed.filter((b) => !b.placement.hidden);
    return { placed: up.length, baked: up.filter((b) => b.bake?.complete).length };
  }

  /** Resolves once the GPU has done all the work sent to it so far (the renderer check). */
  gpuDone(): Promise<void> {
    const backend = (this.renderer as unknown as {
      backend: { isWebGPUBackend?: boolean; device?: GPUDevice; gl?: WebGL2RenderingContext };
    }).backend;
    if (backend.isWebGPUBackend && backend.device) return backend.device.queue.onSubmittedWorkDone();
    return backend.gl ? fenced(backend.gl) : Promise.resolve();
  }

  /** Whether three.js is still starting, a program compiling, or a body's bake waiting for one. */
  get settling(): boolean {
    if (this.failed) return false;
    return (
      !this.started ||
      !this.passesReady ||
      this.compiling > 0 ||
      !this.skyReady() ||
      this.placed.some((b) => !b.placement.hidden && (b.bake === null || !b.bake.complete))
    );
  }

  // --- Drawing --------------------------------------------------------------------------------

  /** The scene at `seconds` on its clock; nothing until three.js is up and the sky's programs have compiled (false). */
  draw(seconds: number): boolean {
    if (!this.started || !this.frame || !this.passes || !this.passesReady) return false;
    // The first picture waits for the whole sky; after it, a sky draw being made again (another
    // texture, blend or depth) is left out till it is ready, the rest drawn.
    if (!this.skyReady() && !this.drawnOnce) return false;
    const r = this.renderer;
    const { width, height } = this.canvas;
    if (this.stillDirty) this.drawStill();
    const viewProjection = multiply(this.projection, this.view);
    for (const body of this.placed) if (this.bakeDue(body, seconds)) this.bakeBody(body, seconds, viewProjection);
    for (const output of OUTPUTS) {
      const colour = output === 'colour';
      r.setRenderTarget(this.target(this.frame, output));
      this.passes.copy.get(output)!.render(r);
      this.drawMeshes(seconds, 'background', output, true);
      if (colour) this.drawParticles(seconds, 'background');
      r.setRenderTarget(this.target(this.frame, output));
      this.passes.composite.get(`scene:${output}`)!.render(r);
      this.passes.copyDepth.get(output)!.render(r);
      this.compositeBodies(viewProjection, output);
      this.drawMeshes(seconds, 'scene', output, true);
      if (colour) this.drawParticles(seconds, 'scene');
      this.drawMeshes(seconds, 'foreground', output);
      if (colour) this.drawParticles(seconds, 'foreground');
    }
    this.drawBloom();
    const tone = this.passes.toneUniforms;
    const tints = [this.tint, this.fadingFrom];
    tints.forEach((t, i) => {
      tone.set(`uTint${i}`, t.colour);
      tone.set(`uBlend${i}`, BLEND_MODES[t.blend]);
    });
    tone.set('uFade', this.fade);
    tone.set('uBloomStrength', BLOOM_STRENGTH);
    tone.set('uExposure', this.loaded.scene.tone.exposure);
    tone.set('uWhitePoint', this.loaded.scene.tone.whitePoint);
    tone.set('uHeight', height);
    const b = this.backdrop;
    tone.set('uBackdrop', b ? (b.kind === 'colour' ? 1 : 2) : 0);
    if (b) {
      const [first, second] = b.kind === 'colour' ? [b.colour, b.colour] : b.colours;
      tone.set('uBackdropA', first);
      tone.set('uBackdropB', second);
      const cssWidth = this.canvas.clientWidth || width;
      const size = b.kind === 'grid' ? b.size : 1;
      tone.set('uGridSize', Math.max(1, (size * width) / cssWidth));
    }
    r.setRenderTarget(null);
    this.passes.tone.render(r);
    this.drawBeams(viewProjection);
    if (this.timing)
      void r.resolveTimestampsAsync().then((ms) => {
        if (typeof ms === 'number' && ms > 0) this.gpuTimesMs.push(ms);
      });
    this.changed = false;
    this.drawnOnce = true;
    // (The editor's aids once the whole picture is up: see `compileAids`.)
    if (!this.aidsAsked && !this.placed.some((b) => !b.placement.hidden && !b.bake?.complete)) {
      this.aidsAsked = true;
      this.compileAids();
    }
    return true;
  }

  /** The sky's draws at a depth (those that move, or those that don't; the foreground's all) into the bound target's pass. */
  private drawMeshes(seconds: number, depth: MaterialDepth, output: Output, moving?: boolean): void {
    if (this.backdrop) return;
    const states = this.skyStates.filter(
      (s) => s.enabled && s.depth === depth && (moving === undefined || s.moving === moving),
    );
    if (!states.length) return;
    // Each anchor's view (see `skyView`), and where the eye is for it and its axes, in the sky's
    // own space (where its meshes' points are): what a draw is shaded from.
    const seen = new Map<SkyAnchor, { viewProjection: Float32Array; eye: Vec3; right: Vec3; up: Vec3 }>();
    const seenAs = (anchor: SkyAnchor) => {
      let found = seen.get(anchor);
      if (!found) {
        const v = this.skyView(anchor);
        found = {
          viewProjection: multiply(this.projection, v),
          eye: anchor === 'world' ? this.camera.eye : eyeOf(v),
          right: [v[0]!, v[4]!, v[8]!],
          up: [v[1]!, v[5]!, v[9]!],
        };
        seen.set(anchor, found);
      }
      return found;
    };
    const threshold = this.sceneThreshold();
    const tint = new UniformSet();
    tintUniforms(tint, 'uBodyTint', this.sky.tint);
    for (const g of this.gpuDraws.values()) g.mesh.visible = false;
    states.forEach((s, order) => {
      const g = this.gpuOf(s);
      if (!g?.ready) return;
      const u = g.uniforms;
      const view = seenAs(s.anchor);
      u.set('uViewProjection', view.viewProjection);
      u.set('uSceneThreshold', threshold);
      u.set('uGlowThreshold', threshold);
      u.set('uPattern', 0);
      u.set('uShadeCount', 0);
      u.apply(tint);
      u.set('uRimTurn', [0, 0]);
      u.set('uEye', view.eye);
      u.set('uRight', view.right);
      u.set('uUp', view.up);
      u.set('uSmear', this.smear);
      u.set('uLit', 0);
      u.set('uOutput', output === 'glow' ? 1 : 0);
      for (const { slot, layer } of s.scrolls) u.set(`uLayers[${slot}].offset`, layerOffset(layer, seconds));
      g.mesh.renderOrder = order;
      g.mesh.visible = true;
    });
    // The target is the frame's, or a still target's: whichever is bound.
    this.renderer.render(this.skyScene, this.camera3);
    for (const s of states) {
      const g = this.gpuDraws.get(s.draw.id);
      if (g) g.mesh.visible = false;
    }
  }

  private drawParticles(seconds: number, depth: MaterialDepth): void {
    if (this.backdrop) return;
    const list = this.particles.filter((p) => this.depthOf(p.name, this.sky.materials?.[p.name], false) === depth);
    if (!list.length) return;
    const tint = new UniformSet();
    tintUniforms(tint, 'uBodyTint', this.sky.tint);
    let any = false;
    for (const p of this.particles) if (p.gpu) p.gpu.mesh.visible = false;
    for (const p of list) {
      p.system.update(seconds);
      const settings = this.sky.materials?.[p.name];
      if (!(settings?.enabled ?? MATERIAL_DEFAULTS.enabled)) continue;
      const layer = p.material.diffuse!;
      const gpu = this.particleGpu(p, depth);
      if (!gpu?.ready) continue;
      const u = gpu.uniforms;
      u.set('uView', this.skyView(skyAnchorOf(settings, this.sky.anchor)));
      u.set('uProjection', this.projection);
      u.set('uStreak', this.streak);
      u.apply(tint);
      u.set('uChannel', CHANNELS[layer.channel ?? 'rgb']);
      u.set('uBright', layerBrightness(layer.brightMult) * (settings?.strength ?? MATERIAL_DEFAULTS.strength));
      p.buffer.needsUpdate = true;
      p.geometry.instanceCount = p.system.count;
      gpu.mesh.visible = p.system.count > 0;
      any ||= p.system.count > 0;
    }
    if (any) this.renderer.render(this.particleScene, this.camera3);
  }

  /** A particle system's GPU side, for a depth: the one kept, else one made (its compile asked for); none while its texture's mipmaps are being made. */
  private particleGpu(p: ParticleDraw, depth: MaterialDepth): ParticleDraw['gpu'] {
    if (p.gpu && p.gpu.depth === depth) return p.gpu;
    const layer = p.material.diffuse!;
    const tex = this.sampledTexture(layer.texture, layer.wrap);
    if (!tex) return null;
    if (p.gpu) this.release(p.gpu);
    const uniforms = new ShaderUniforms();
    const material = particleMaterial(uniforms, tex, this.toClip, depth === 'scene');
    const mesh = new Mesh(p.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.particleScene.add(mesh);
    p.gpu = { mesh, uniforms: uniforms.values, depth, ready: false, state: 'particle' };
    this.requestCompile();
    return p.gpu;
  }

  private bakeKey(body: Placed): string {
    return `${this.viewVersion}:${this.skyVersion}:${body.version}:${body.hasShapes ? this.surfacesKey : ''}`;
  }

  private bakeDue(body: Placed, seconds: number): boolean {
    if (body.placement.hidden) return false;
    const b = body.bake;
    if (!b || !b.complete || b.key !== this.bakeKey(body)) return true;
    return b.scroll > 0 && Math.abs(seconds - b.at) * b.scroll >= REBAKE_PIXELS;
  }

  private newBake(): Bake {
    return { pass: null, width: 0, height: 0, rect: null, key: '', at: 0, complete: false, scroll: 0, shift: 0 };
  }

  private sizeBake(bake: Bake, rect: PixelRect): void {
    const fits = rect.w <= bake.width && rect.h <= bake.height;
    const roomy = bake.width > 2 * bakeSize(rect.w) || bake.height > 2 * bakeSize(rect.h);
    if (fits && !roomy && bake.pass) return;
    bake.width = bakeSize(rect.w);
    bake.height = bakeSize(rect.h);
    this.freePass(bake.pass);
    bake.pass = this.newPass(bake.width, bake.height);
  }

  private freeBake(bake: Bake | null): void {
    if (!bake) return;
    this.freePass(bake.pass);
    bake.pass = null;
  }

  /**
   * A body drawn on its own into its bake: the frame's pixels it covers, each as the frame has it,
   * its draws in its drawing order, at `seconds`. Its view is drawn through a projection that puts
   * the rectangle it covers onto its bake (not an offset viewport: WebGPU allows none past a
   * target's edge).
   */
  private bakeBody(body: Placed, seconds: number, viewProjection: Float32Array): void {
    // Baked only whole: until every draw of it is ready (built now where missing), its last whole
    // bake stays up (a new body shows once whole); `bakeDue` asks again each frame meanwhile.
    // (Every part asked for, not only up to the first that isn't ready: each one's mipmaps and
    // compile start together, not one after another.)
    let whole = true;
    for (const s of body.states) if (s.enabled && s.part && !this.gpuOf(s)?.ready) whole = false;
    if (!whole) return;
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
    // An odd-height rectangle a row down in its bake: its rows then pair in the GPU's 2x2 quads
    // (its derivatives: its edges' smoothing, its textures' detail) as they pair from the
    // rectangle's bottom, whether the bake is read from its top (WebGPU) or its bottom (WebGL).
    bake.shift = rect.h % 2;
    this.sizeBake(bake, { ...rect, h: rect.h + bake.shift });
    // The rectangle (its left, and its top from the top, less the shift) onto the bake, pixel for pixel.
    const top = height - (rect.y + rect.h) - bake.shift;
    const bw = bake.width;
    const bh = bake.height;
    const onBake = new Float32Array([
      width / bw, 0, 0, 0,
      0, height / bh, 0, 0,
      0, 0, 1, 0,
      (width - 2 * rect.x) / bw - 1, 1 + (2 * top - height) / bh, 0, 1,
    ]);
    const bakeViewProjection = multiply(onBake, viewProjection);
    const v = this.view;
    const right = intoFrame(axes, [v[0]!, v[4]!, v[8]!]);
    const up = intoFrame(axes, [v[1]!, v[5]!, v[9]!]);
    const eyeDistance = Math.hypot(...body.frame.eye);
    const radius = body.placement.radius;
    const pixel = (2 * eyeDistance * radius * Math.tan((this.camera.fovY * Math.PI) / 360)) / height;
    const spot = frameSpot(position, radius, [v[0]!, v[4]!, v[8]!], viewProjection, width, height);
    // (The sky light is read from the top left: its spot's height and up turned over.)
    const skyAt = [spot[0], 1 - spot[1], spot[2], -spot[3]];
    const surfaces = new UniformSet();
    surfaces.i1('uSurfaceCount', this.surfaces.length);
    surfaces.fv('uSurfaces', [...this.surfaces.flat(), ...Array<number>((MAX_SURFACES - this.surfaces.length) * 4).fill(0)], '4fv');
    const scene = this.bodyScene(body);
    for (const c of scene.children) c.visible = false;
    let complete = true;
    const drawn: { gpu: GpuDraw; order: number }[] = [];
    body.states.forEach((s, order) => {
      if (!s.enabled || !s.part) return;
      const gpu = this.gpuOf(s);
      if (!gpu?.ready) {
        complete = false;
        return;
      }
      const u = gpu.uniforms;
      u.set('uViewProjection', bakeViewProjection);
      u.set('uSmear', 0);
      u.set('uSceneThreshold', this.sceneThreshold());
      u.set('uCentre', position);
      u.set('uAxes', axes);
      u.set('uRadius', radius);
      u.set('uEye', body.frame.eye);
      u.set('uRight', right);
      u.set('uUp', up);
      u.set('uSkyAt', skyAt);
      u.apply(surfaces);
      for (const { slot, layer } of s.scrolls) u.set(`uLayers[${slot}].offset`, layerOffset(layer, seconds));
      const reachOf = partsExtent(radius, [s.part], eyeDistance * radius) + 2 * pixel;
      u.set('uExtent', Math.min(e, reachOf));
      const shape = s.part.shape;
      if (shape.kind === 'ring') {
        const k = ringScale(shape, eyeDistance);
        u.set('uShapeParams', [shape.inner * k, shape.outer * k, shape.depth]);
      }
      gpu.mesh.renderOrder = order;
      gpu.mesh.visible = true;
      drawn.push({ gpu, order });
    });
    for (const output of OUTPUTS) {
      for (const { gpu } of drawn) gpu.uniforms.set('uOutput', output === 'glow' ? 1 : 0);
      this.clear(this.target(bake.pass!, output), 0);
      if (drawn.length) this.renderer.render(scene, this.camera3);
    }
    for (const { gpu } of drawn) gpu.mesh.visible = false;
    bake.complete = complete;
    bake.scroll = scrollPixels(
      body.states
        .filter((s) => s.enabled)
        .flatMap((s) => s.scrolls.map(({ layer }) => layer))
        .flatMap((l) => (l.scroll ? [{ scroll: l.scroll, tiling: l.tiling }] : [])),
      rect,
    );
  }

  /** The bodies' bakes put back into the frame (its target for this output bound), far to near. */
  private compositeBodies(viewProjection: Float32Array, output: Output): void {
    const { width, height } = this.canvas;
    const eye = this.camera.eye;
    const shownBodies = this.placed
      .filter((b) => !b.placement.hidden && b.bake?.complete && b.bake.rect && b.bake.pass)
      .sort((a, b) => distance(b.placement.position, eye) - distance(a.placement.position, eye));
    for (const body of shownBodies) {
      const bake = body.bake!;
      const r = bake.rect!;
      const top = height - (r.y + r.h);
      // Each in turn: its depths, then its colour (the next body's over it).
      for (const impostor of this.impostorsOf(bake.pass!)[output]) {
        const u = impostor.uniforms;
        // Its rectangle in the frame's normalized device coordinates (y up), its corner from the top left.
        u.set('uRect', [(2 * r.x) / width - 1, 1 - (2 * (top + r.h)) / height, (2 * (r.x + r.w)) / width - 1, 1 - (2 * top) / height]);
        u.set('uOrigin', [r.x, top - bake.shift]);
        u.set('uFront', this.frontDepth(body, viewProjection));
        this.renderer.render(impostor.scene, this.camera3);
      }
    }
  }

  /** A bake's impostors (made the first time it is put into the frame; let go of with its pass). */
  private impostorsOf(pass: Pass): Record<Output, ImpostorDraw[]> {
    let made = this.bakeImpostors.get(pass);
    if (!made) {
      const of = (output: Output) => {
        const target = this.target(pass, output);
        return ([0, 1] as const).map((n) => {
          const uniforms = new DrawValues({ colour: target.texture, depth: target.depthTexture! });
          const mesh = withValues(new Mesh(this.square, this.passes!.impostors[n]!.material), uniforms);
          mesh.frustumCulled = false;
          const scene = new Scene();
          scene.add(mesh);
          return { mesh, scene, uniforms };
        });
      };
      made = { colour: of('colour'), glow: of('glow') };
      this.bakeImpostors.set(pass, made);
    }
    return made;
  }

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

  private drawBloom(): void {
    const r = this.renderer;
    const bloom = this.bloom!;
    this.bloomThreshold.value = this.sceneThreshold();
    r.setRenderTarget(bloom[0]);
    this.passes!.bloomPrepass.render(r);
    const [w, h] = [bloom[0].width, bloom[0].height];
    for (let i = 0; i < BLOOM_PASSES * 2; i++) {
      const from = i % 2;
      this.blurSteps[from].value.set(i % 2 === 0 ? BLOOM_SPACING / w : 0, i % 2 === 0 ? 0 : BLOOM_SPACING / h);
      r.setRenderTarget(bloom[(i + 1) % 2]);
      this.passes!.blur[from].render(r);
    }
  }

  /** The tone-mapped picture's target, made to be read back (`readPixels`). */
  private shownTarget: RenderTarget | null = null;

  /**
   * The last frame's picture as shown (tone-mapped; no beams), top row first, RGBA: for the
   * renderer check, which compares the picture drawn on WebGPU with the one drawn on WebGL 2.
   */
  async readPixels(): Promise<Uint8Array> {
    const { width, height } = this.canvas;
    if (!this.passes) return new Uint8Array(width * height * 4);
    if (!this.shownTarget || this.shownTarget.width !== width || this.shownTarget.height !== height) {
      this.shownTarget?.dispose();
      this.shownTarget = new RenderTarget(width, height, {
        type: UnsignedByteType,
        format: RGBAFormat,
        generateMipmaps: false,
        depthBuffer: false,
      });
    }
    this.renderer.setRenderTarget(this.shownTarget);
    this.passes.tone.render(this.renderer);
    this.renderer.setRenderTarget(null);
    const data = new Uint8Array(
      ((await this.renderer.readRenderTargetPixelsAsync(this.shownTarget, 0, 0, width, height)) as Uint8Array).buffer,
    );
    const row = width * 4;
    const out = new Uint8Array(row * height);
    if (this.backendName === 'WebGPU') {
      // WebGPU's rows are padded to 256 bytes each, top row first.
      const stride = Math.ceil(row / 256) * 256;
      for (let y = 0; y < height; y++) out.set(data.subarray(y * stride, y * stride + row), y * row);
    } else {
      // WebGL's bottom row first.
      for (let y = 0; y < height; y++) out.set(data.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    return out;
  }

  /** Beams to show over the picture (none: none); drawn at the next frame. */
  setBeams(beams: readonly LightAid[]): void {
    if (beams === this.beams) return;
    this.beams = beams;
    this.changed = true;
  }

  /** The n-th of an aid kind's draws (made where there aren't that many yet). */
  private aid(kind: AidKind, n: number): { mesh: Mesh; uniforms: ShaderUniforms } {
    let pool = this.aidPool.get(kind);
    if (!pool) this.aidPool.set(kind, (pool = []));
    while (pool.length <= n) {
      const uniforms = new ShaderUniforms();
      const depth = this.frame!.colour.depthTexture!;
      const material =
        kind === 'outline' ? outlineMaterial(uniforms, depth, this.toClip) : beamMaterial(uniforms, depth, kind, this.toClip);
      pool.push({ mesh: this.aidMesh(kind === 'outline' ? this.square : this.beamGeometry, material), uniforms });
    }
    return pool[n]!;
  }

  /**
   * The beams and outlines over the picture as shown (after its exposure and bloom: as they are
   * whatever the scene's light), each hidden where the frame's depth is nearer; one that lights
   * adds its colour, one that darkens takes it away.
   */
  private drawBeams(viewProjection: Float32Array): void {
    if (!this.beams.length || !this.frame || !this.aidsReady) return;
    const eye = this.camera.eye;
    const spheres = this.placed
      .map(({ placement: { position, radius } }) => [...position, radius] as const)
      .sort((a, b) => distance([a[0], a[1], a[2]], eye) - distance([b[0], b[1], b[2]], eye))
      .slice(0, MAX_BEAM_SPHERES);
    const shared = new UniformSet();
    shared.m4('uViewProjection', viewProjection);
    shared.v3('uEye', eye);
    shared.i1('uSphereCount', spheres.length);
    shared.fv('uSurfaces', [...spheres.flat(), ...Array<number>((MAX_BEAM_SPHERES - spheres.length) * 4).fill(0)], '4fv');
    const used = new Map<AidKind, number>();
    const next = (kind: AidKind) => {
      const n = used.get(kind) ?? 0;
      used.set(kind, n + 1);
      return this.aid(kind, n);
    };
    const outlines: Mesh[] = [];
    const beams: Mesh[] = [];
    const rad = Math.PI / 180;
    for (const aid of this.beams) {
      if (aid.shape === 'outline') {
        const o = aid as LightOutline;
        const { mesh, uniforms } = next('outline');
        outlines.push(mesh);
        uniforms.apply(shared);
        uniforms.set('uCentre', o.centre);
        uniforms.set('uAxes', o.axes);
        uniforms.set('uRadius', o.radius);
        uniforms.set('uExtent', o.radius * OUTLINE_EXTENT);
        uniforms.set('uKind', o.kind);
        uniforms.set('uDir', o.direction);
        uniforms.set('uPos', o.position);
        uniforms.set('uAim', o.aim);
        uniforms.set('uFade', o.fade);
        uniforms.set('uCosCone', Math.cos(o.cone * rad));
        uniforms.set('uCosFade', Math.cos(o.cone * (1 - o.edge) * rad));
        uniforms.set('uColor', o.darkens ? [1, 1, 1] : o.colour);
        uniforms.set('uAlpha', OUTLINE_ALPHA);
        continue;
      }
      const way = normalize(aid.from);
      const [across, up] = beamAcross(way);
      const kinds = aid.darkens ? (['dark', 'edge'] as const) : (['light'] as const);
      for (const kind of kinds) {
        const { mesh, uniforms } = next(kind);
        beams.push(mesh);
        uniforms.apply(shared);
        uniforms.set('uCentre', aid.centre);
        uniforms.set('uBody', [...aid.centre, aid.radius]);
        uniforms.set('uWay', way);
        uniforms.set('uAcross', across);
        uniforms.set('uUp', up);
        uniforms.set('uRadius', aid.radius);
        uniforms.set('uLength', aid.radius * BEAM_LENGTH);
        uniforms.set('uColor', kind === 'edge' ? [1, 1, 1] : aid.colour);
        uniforms.set('uAlpha', kind === 'dark' ? DARK_BEAM_ALPHA : kind === 'edge' ? BEAM_EDGE_ALPHA : BEAM_ALPHA);
      }
    }
    // Outlines first, then the beams over them.
    this.renderer.setRenderTarget(null);
    for (const mesh of [...outlines, ...beams]) {
      this.beamScene.add(mesh);
      this.renderer.render(this.beamScene, this.camera3);
      this.beamScene.remove(mesh);
    }
  }

  private aidMesh(geometry: BufferGeometry, material: NodeMaterial): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Free what the GPU holds. */
  dispose(): void {
    for (const g of this.gpuDraws.values()) freeGpu(g);
    for (const t of this.sampled.values()) t.dispose();
    for (const p of [this.stillBackground, this.stillScene, this.frame]) this.freePass(p);
    for (const t of this.bloom ?? []) t.dispose();
    for (const placed of this.placed) this.freeBake(placed.bake);
    this.skyLight.dispose();
    this.renderer.dispose();
  }

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

  private updateSurfaces(): void {
    const surfaces: number[][] = [];
    for (const placed of this.placed) {
      const seen = new Set<PartKey | undefined>();
      for (const s of placed.states) {
        const { part } = s;
        if (!s.enabled || s.draw.part?.role !== 'surface' || part?.shape.kind !== 'sphere') continue;
        if (seen.has(s.draw.partKey)) continue;
        seen.add(s.draw.partKey);
        const { shape } = part;
        const { position, radius } = placed.placement;
        const [x, y, z] = (shape.centre ?? [0, 0, 0]).map((c) => c * radius) as [number, number, number];
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

  private shadeOf(placement: PlanetPlacement): BodyShade {
    const worn = overlaysOf(placement);
    const wears = wearsIn(placement);
    return {
      ...DEFAULT_SHADE,
      ...placement.planet.planet.tuning?.shade,
      ...worn.reduce((a: Partial<BodyShade>, o, i) => ({ ...a, ...o.planet.shade, ...wears[i]?.shade }), {}),
      ...placement.shade,
    };
  }

  private material(name: string, where: string, materials: Readonly<Record<string, SceneMaterial>>): SceneMaterial {
    const material = materials[name];
    if (!material) throw new Error(`${where}: no material ${name} in the scene`);
    if (!['opaque', 'alpha', 'add', 'alphaAdd'].includes(material.blend))
      throw new Error(`${name}: ${material.blend} blending isn't drawn yet`);
    return material;
  }
}

