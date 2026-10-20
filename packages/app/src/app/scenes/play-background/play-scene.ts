/**
 * The Play screen's background as heroes-capture exports it from the game (`heroes-capture ui
 * background`): the cutscene's camera, the meshes of the sky as the model's Stand pose places
 * them, their materials' layers, the twinkling stars' particle system, and the textures.
 */

/** The game's camera: where it is, which way it looks, its vertical field of view in degrees. */
export interface SceneCamera {
  readonly eye: readonly [number, number, number];
  readonly forward: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly fovY: number;
  readonly near: number;
  readonly far: number;
}

/**
 * Where a scene puts the camera, over the game's (each where set): where it is, the way it looks,
 * and its field of view (vertical, degrees). Its up stays the world's.
 */
export type SceneCameraSet = Partial<Pick<SceneCamera, 'eye' | 'forward' | 'fovY'>>;

/** The Play screen's own planets, by their size, as the game's atmosphere materials name them. */
export type PlanetSize = 'large' | 'medium' | 'small';

/** A mesh in world space: positions (xyz), texture coordinates (uv), RGBA colours (0-255), triangles. */
export interface SceneMesh {
  readonly positions: readonly number[];
  readonly uvs: readonly number[];
  /** Second texture coordinates (uv), where a layer reads them. */
  readonly uvs2?: readonly number[];
  /** Normals (xyz), where a layer's fresnel needs them. */
  readonly normals?: readonly number[];
  readonly colors: readonly number[];
  readonly indices: readonly number[];
  /** The materials drawn on it, in order (a composite material's sections). */
  readonly materials: readonly string[];
  /** The planet it belongs to, by size; none for the sky's meshes. */
  readonly planet?: PlanetSize;
}

/** Which of a texture's channels a layer reads. */
export type LayerChannel = 'rgb' | 'rgba' | 'a' | 'r' | 'g' | 'b';

/** How much a layer shows by how far its surface turns from the camera (see the shader). */
export interface SceneFresnel {
  /** 1: strongest edge-on; 2: inverted. */
  readonly type: number;
  readonly exponent: number;
  readonly min: number;
  readonly max: number;
  /** Radians the view is turned by first. */
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * A material's layer: a texture, its channel, its brightness and its texture-coordinate transform;
 * or a colour of its own (`color`, no texture).
 */
export interface SceneLayer {
  readonly texture?: string;
  /** RGBA 0-255, for a layer without a texture. */
  readonly color?: SceneColor;
  readonly fresnel?: SceneFresnel;
  /** Which of the mesh's texture coordinates it reads: the first (the default) or the second. */
  readonly uvSet?: 1 | 2;
  readonly channel?: LayerChannel;
  readonly brightMult: number;
  readonly midtone?: number;
  readonly offset?: readonly [number, number];
  /** Radians, about the texture's centre. */
  readonly angle?: number;
  readonly tiling?: readonly [number, number];
  /** Whether a texture repeats across u, and across v; where it doesn't, it stops at its edge. */
  readonly wrap?: readonly [boolean, boolean];
  /** The offset's steady scroll: `by` over `seconds`, looping (or, `endless`, going on). */
  readonly scroll?: {
    readonly seconds: number;
    readonly by: readonly [number, number];
    readonly endless?: boolean;
  };
}

export type SceneBlend = 'opaque' | 'alpha' | 'add' | 'alphaAdd';

export interface SceneMaterial {
  readonly blend: SceneBlend;
  /** Drawn as its diffuse colour, without lighting. */
  readonly unshaded: boolean;
  readonly vertexAlpha: boolean;
  readonly vertexColor: boolean;
  readonly emissiveMult: number;
  /** How the emissive layer joins the diffuse: added (the default), or multiplying it (mod, mod2x). */
  readonly emissiveBlend?: 'add' | 'mod' | 'mod2x';
  /** Blended materials are drawn highest first. */
  readonly priority?: number;
  /** An opaque material is cut out where its alpha is below this. */
  readonly cutout?: number;
  readonly diffuse: SceneLayer | null;
  readonly emissive: SceneLayer | null;
  readonly alphaMasks: readonly SceneLayer[];
}

/** RGBA, 0-255. */
export type SceneColor = readonly [number, number, number, number];

/**
 * A particle system emitting from a mesh. Size, colour and alpha each run through three keys over a
 * particle's life (start, middle at `*Middle` of it, held for `*Hold` of it, end); each particle
 * picks its own sizes and colours between the two sets given.
 */
export interface SceneParticles {
  readonly emitter: string;
  readonly material: string;
  /** Particles a second. */
  readonly rate: number;
  readonly max: number;
  /** Seconds: shortest, longest. */
  readonly lifespan: readonly [number, number];
  readonly speed: readonly [number, number];
  /** [start, middle, end] world sizes, twice: a particle's lie between them. */
  readonly sizes: readonly [readonly [number, number, number], readonly [number, number, number]];
  readonly colors: readonly [
    readonly [SceneColor, SceneColor, SceneColor],
    readonly [SceneColor, SceneColor, SceneColor],
  ];
  readonly sizeMiddle: number;
  readonly sizeHold: number;
  readonly colorMiddle: number;
  readonly colorHold: number;
  readonly alphaMiddle: number;
  readonly alphaHold: number;
  /** The emitter mesh's vertex alpha scales each particle's alpha where it is born. */
  readonly vertexAlpha: boolean;
}

export interface SceneTexture {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  /** Where it is in the game data (a baked one: the texture it was baked from). */
  readonly source?: string;
  /** Whether it was baked from its source onto its planet's own mapping by the exporter. */
  readonly baked?: boolean;
}

/** The light's HDR tone mapping: its exposure, and the brightness that shows as white. */
export interface SceneTone {
  readonly exposure: number;
  readonly whitePoint: number;
  /** The brightness the light's bloom starts from, where the data sets it. */
  readonly bloomThreshold?: number;
}

/**
 * A sky overlay's part's shape: a mesh as the sky's are (the game data's, in world space, about the
 * game's camera), or a band about the eye (one made in the editor): part of an upright cylinder
 * `distance` from the eye, from `low` to `high` degrees up from level, `from` to `to` degrees round
 * from the view's middle (to the right positive).
 */
export type SkyShape =
  | ({ readonly kind: 'mesh' } & Omit<SceneMesh, 'materials' | 'planet'>)
  | {
      readonly kind: 'band';
      readonly distance: number;
      readonly low: number;
      readonly high: number;
      readonly from: number;
      readonly to: number;
    };

/** A part of a sky overlay: which part it is, its shape, the materials drawn on it in order. */
export interface SkyPart {
  readonly id: string;
  readonly shape: SkyShape;
  readonly materials: readonly string[];
}

/**
 * An overlay a sky wears (the game data's, set apart from the Play screen's sky; or one made in
 * the editor): its name, its parts about the eye, and the materials they draw and the textures
 * those read (the game data's: the scene's own files).
 */
export interface SkyOverlayFile {
  readonly label?: string;
  readonly parts: readonly SkyPart[];
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  readonly textures: Readonly<Record<string, SceneTexture>>;
}

export interface PlayScene {
  readonly camera: SceneCamera;
  readonly tone: SceneTone;
  readonly meshes: Readonly<Record<string, SceneMesh>>;
  readonly materials: Readonly<Record<string, SceneMaterial>>;
  readonly particles: readonly SceneParticles[];
  readonly textures: Readonly<Record<string, SceneTexture>>;
  /** The sky's overlays in the game data, by id (the energy round the view, set apart as one). */
  readonly overlays?: Readonly<Record<string, SkyOverlayFile>>;
  /** The overlays the sky wears unless told otherwise, in order (the game's: all of them). */
  readonly wears?: readonly string[];
}

/** The scene with its textures decoded, ready to draw. */
export interface LoadedPlayScene {
  readonly scene: PlayScene;
  readonly images: Readonly<Record<string, ImageBitmap>>;
}

/** Where the app serves the exported scene (public/backgrounds/play). */
export const PLAY_SCENE_URL = 'backgrounds/play/';

/**
 * The scene and its textures. The textures are decoded as stored: a layer may read one channel of
 * one (the stars' alpha is a mask of its own), so nothing is premultiplied or colour-converted.
 */
export async function loadPlayScene(base: string, signal?: AbortSignal): Promise<LoadedPlayScene> {
  const at = (file: string) => new URL(file, new URL(base, document.baseURI)).href;
  const scene = await loadPlaySceneFile(base, signal);
  const entries = await Promise.all(
    Object.entries(scene.textures).map(async ([key, texture]) => {
      const file = await fetch(at(texture.file), { signal });
      if (!file.ok)
        throw new Error(`the texture ${texture.file} (${file.status} ${file.statusText})`);
      const image = await createImageBitmap(await file.blob(), {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      });
      return [key, image] as const;
    }),
  );
  return { scene, images: Object.fromEntries(entries) };
}

/** The scene's file alone, as exported (its textures not loaded): what it is made of. */
export async function loadPlaySceneFile(base: string, signal?: AbortSignal): Promise<PlayScene> {
  const url = new URL('scene.json', new URL(base, document.baseURI)).href;
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(`the Play screen background (${response.status} ${response.statusText})`);
  return (await response.json()) as PlayScene;
}

/**
 * A layer's offset at a time: its own, plus its scroll's progress through the loop (the data's
 * start again, as the game's do); an endless one's keeps going, less whole texture widths (a
 * repeating texture looks the same a whole width on).
 */
export function layerOffset(layer: SceneLayer, seconds: number): [number, number] {
  const [u, v] = layer.offset ?? [0, 0];
  const scroll = layer.scroll;
  if (!scroll) return [u, v];
  if (scroll.endless) {
    const t = seconds / scroll.seconds;
    const fract = (x: number) => x - Math.floor(x);
    return [u + fract(scroll.by[0] * t), v + fract(scroll.by[1] * t)];
  }
  const f = (seconds % scroll.seconds) / scroll.seconds;
  return [u + scroll.by[0] * f, v + scroll.by[1] * f];
}

/**
 * A value through three keys over a particle's life `t` (0-1): from `start` to `middle` until
 * `at`, held there for `hold`, then to `end`.
 */
export function threeKeys(
  start: number,
  middle: number,
  end: number,
  at: number,
  hold: number,
  t: number,
): number {
  if (t <= at) return at > 0 ? start + (middle - start) * (t / at) : middle;
  if (t <= at + hold) return middle;
  const rest = 1 - at - hold;
  return rest > 0 ? middle + (end - middle) * Math.min(1, (t - at - hold) / rest) : end;
}
