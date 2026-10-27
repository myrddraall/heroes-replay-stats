import type {
  BufferGeometry,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  Mesh,
  RenderTarget,
  Scene,
} from 'three/webgpu';
import type { SceneBlend, SceneLayer, SceneMaterial } from '../formats/play-scene';
import type { ParticleSystem } from '../effects/particles';
import type { Tube } from '../sky/tubes';
import type { BodyPart, PlanetLight } from '../formats/planet-files';
import type { LoadedPlanet } from '../formats/planet-loader';
import type { MaterialDepth } from '../materials/material-settings';
import type { SkyAnchor } from '../sky/sky-anchors';
import type { PartKey } from '../formats/part-keys';
import type { UniformSet } from './uniforms/uniforms';
import type { PixelRect } from './bodies/body-bakes';
import type { BodyFrame } from '../space/space';
import type { BodyDraw, DrawnBody } from '../bodies/drawn-body';
import type { Mat3, Orientation } from '../space/graph';
import type { BodyLeans } from './bodies/body-frames';
import type { DrawValues } from './uniforms/shader-uniforms';

/** What the renderer keeps of each draw: its state, its GPU side, its passes and bakes. */

/**
 * What a draw writes: the colour, or the glow (what blooms beyond the scene's own bloom). Each goes
 * to a target of its own, in a pass of its own, never both at once: with Direct3D (ANGLE), a
 * program linked for one output is compiled again, uncached, the first time it draws into two,
 * and for the bodies' shader that takes the whole browser away for ten seconds or more on every
 * load (the uniform `uOutput` says which a draw writes). A body is baked twice only when it
 * changes; per frame only what moves of the sky is drawn twice (the particles glow not at all:
 * drawn once).
 */
export const OUTPUTS = ['colour', 'glow'] as const;

export type Output = (typeof OUTPUTS)[number];

/** The editor's aids' kinds: an outline, a light's beam, a darkening one's, and its edges. */
export type AidKind = 'outline' | 'light' | 'dark' | 'edge';

/**
 * One material drawn on one mesh, or on one part of a placed planet's body; moving when one of
 * its layers scrolls.
 */
export interface MeshDraw {
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
  /** The planet or overlay the material is of (its materials, for a halo's look); none: the sky's. */
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
  /** The body draw it is, where it is a placed body's. */
  readonly bodyDraw?: BodyDraw;
}

/** A body put up, with its frames as last placed. */
export interface Placed {
  readonly id: number;
  body: DrawnBody;
  /** Its frame facing the eye that draws it (turned with the camera): its squares', and its surfaces' that face the camera. */
  quad: BodyFrame;
  /**
   * Its placement frame (as the scene's own camera sees it, fixed in the world): what the lights
   * of its surfaces fixed in the world are set in, and those surfaces are turned from.
   */
  placementFrame: Mat3;
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
export interface DrawState {
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
  /** Which way a body's part is turned: facing the camera, or fixed in the world (see `Orientation`). */
  readonly orientation?: Orientation;
  /** Whether its body's own turn (its Axis and Turn) turns it (see `DrawTurn`). */
  readonly turned?: boolean;
  /** A body's draw's leans, set where its lights are (turned into the view as it is baked). */
  readonly leans?: BodyLeans;
  /** What it was worked out from (the sky's draws: whether they have to be drawn again). */
  readonly signature: string;
}

/** An impostor drawn for a bake: its mesh (the impostors' shared material) in its scene, and its values (the bake's textures). */
export interface ImpostorDraw {
  readonly mesh: Mesh;
  readonly scene: Scene;
  readonly uniforms: DrawValues;
}

/** A draw's GPU side: its mesh (its kind's shared material), and its values. */
export interface GpuDraw {
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
export interface Releasable {
  readonly mesh: Mesh;
  readonly uniforms: DrawValues;
  compiling?: boolean;
  dropped?: boolean;
}

/** A float render target (half floats) and its glow, drawn in a pass of its own (see `OUTPUTS`), each with its depth. */
export interface Pass {
  colour: RenderTarget;
  glow: RenderTarget;
}

/**
 * A body drawn on its own (baked), into a target the size of the pixels it covers: put back into
 * each frame as it is, until it changes (or the view does, or its layers scroll a pixel on).
 */
export interface Bake {
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

export interface ParticleDraw {
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
export const BLEND_KINDS: readonly SceneBlend[] = ['opaque', 'alpha', 'add', 'alphaAdd'];

/** A shared material's key: its kind of draw, its blend, and whether it is depth tested (a body always is). */
export const sharedKey = (body: boolean, blend: SceneBlend, depth: MaterialDepth) =>
  JSON.stringify([body ? 'body' : 'mesh', blend, body || depth === 'scene']);
