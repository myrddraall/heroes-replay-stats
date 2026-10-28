import type { FrameSections } from './renderer';
import {
  BufferAttribute,
  type BufferGeometry,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';
import { vec4 } from 'three/tsl';
import {
  type LoadedPlayScene,
  layerOffset,
  type SceneCamera,
  type SceneCameraSet,
  type SceneMaterial,
} from '../formats/play-scene';
import { INSTANCE_FLOATS, ParticleSystem } from '../effects/particles';
import {
  MATERIAL_DEFAULTS,
  type MaterialDepth,
  materialKey,
  type MaterialSettings,
} from '../materials/material-settings';
import { AXIS_NAMES_PAST, axisEnds, type EditingAid } from '../aids/beams';
import { fitTube, tubeCover } from '../sky/tubes';
import { skyOverlayParts } from '../sky/sky-overlays';
import { skyDepths } from '../sky/sky-depths';
import { anchoredDepth, anchoredView, type SkyAnchor, skyAnchorOf } from '../sky/sky-anchors';
import type { AddedLight } from '../lights/lights';
import type { LoadedPlanet } from '../formats/planet-loader';
import type { DrawnSky } from '../sky/drawn-sky';
import { overlayOfPartKey, type PartKey } from '../formats/part-keys';
import { BLEND_MODES, NO_TINT, type Tint } from '../tints/tints';
import { MAX_SURFACES } from './uniforms/limits';
import { UniformSet } from './uniforms/uniforms';
import { CHANNELS, layerBrightness, tintUniforms } from './uniforms/draw-uniforms';
import {
  type Backdrop,
  bodyFrame,
  eyeOf,
  multiplyMatrices as multiply,
  partsExtent,
  projectionMatrix,
  reach,
  viewMatrix,
  viewUp,
  type Viewpoint,
} from '../space/space';
import { DEFAULT_ORIENTATION, isIdentity, placementFrame, surfaceFrame } from '../space/graph';
import { particleMaterial } from './particle-shader';
import type { ToClip } from './passes/pass-shaders';
import { ShaderUniforms } from './uniforms/shader-uniforms';
import { prepareMipmaps } from './textures/mipmaps';
import { SceneTextures } from './textures/scene-textures';
import { EditingAids } from './aids/editing-aids';
import { PassChain } from './passes/pass-chain';
import { GpuDraws } from './gpu-draws';
import { BodyBaker } from './bodies/body-baker';
import { type DrawContext, drawStateOf } from './draw-states';
import {
  BLEND_KINDS,
  type DrawState,
  type MeshDraw,
  OUTPUTS,
  type Output,
  type ParticleDraw,
  type Placed,
} from './draw-types';
import { BLOOM_STRENGTH, DEFAULT_BLOOM_THRESHOLD } from './tuning';
import { fenced, freeGpu, meshGeometry } from './gpu';
import { fileId, moves, sorted, turnFor, withoutHidden } from './bodies/body-draws';
import { type Vec3, distance, turnAbout } from '../space/vectors';
import type { DrawnBody } from '../bodies/drawn-body';
let nextPlacedId = 0;

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
export class ThreeRenderer {
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
  /** The scene's images as its draws sample them (the planets' added as they come). */
  private readonly textures: SceneTextures;
  private readonly particleScene = new Scene();
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
  private skyVersion = 0;
  private view: Float32Array = new Float32Array(16);
  private projection: Float32Array = new Float32Array(16);
  private yaw = 0;
  private stillDirty = true;
  private changed = true;
  private viewVersion = 0;
  private surfaces: number[][] = [];
  private surfacesKey = '';
  /** The draws' GPU side, and their programs compiled. */
  private readonly gpu: GpuDraws;
  /** The bodies' bakes. */
  private readonly bakes: BodyBaker;
  /** The editor's aids over the picture. */
  private readonly aids: EditingAids;
  /** What working a draw out reads of the scene (see `drawStateOf`). */
  private readonly drawContext: DrawContext = {
    settingsOf: (draw) => this.settingsOf(draw),
    hasTexture: (key) => this.textures.has(key),
    addedTo: (body) => this.addedTo(body),
    skyAnchor: () => this.sky.anchor,
    depthOf: (name, settings, placed) => this.depthOf(name, settings, placed),
    exposure: () => this.loaded.scene.tone.exposure,
    sceneThreshold: () => this.sceneThreshold(),
    dim: () => this.dim,
  };
  /** The targets a picture is drawn through, and the passes between them. */
  private readonly chain: PassChain;
  private readonly gpuTimesMs: number[] = [];
  private readonly sections: FrameSections[] = [];
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
  /** How strongly the editor's beams and outlines show, 0 to 1 (faded in once the planets are where they are going). */
  aidFade = 1;
  private dimmedBy = 1;
  /** How bright the sky and the bodies marked dimmed are drawn (see `Renderer`): a change draws again. */
  get dim(): number {
    return this.dimmedBy;
  }
  set dim(dim: number) {
    if (dim === this.dimmedBy) return;
    this.dimmedBy = dim;
    // (Those dimmed in part are baked so: baked again.)
    for (const placed of this.placed) if (placed.body.dimmedOutside) this.resolveBody(placed);
    this.stillDirty = true;
    this.changed = true;
  }
  private sky: DrawnSky = { worn: [], materials: {} };
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
  /**
   * The scene's own camera (its file's): what the bodies' placement frames are turned to (as it
   * sees them), whatever camera draws them, so the lights of their surfaces fixed in the world
   * stay put.
   */
  private readonly layout: Viewpoint;

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
    // (Its draw calls counted over a whole frame, not each pass: see `frameSections`.)
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.textures = new SceneTextures(
      loaded.images,
      () =>
        this.backendName === 'WebGPU'
          ? (this.renderer as unknown as { backend: { device: GPUDevice } }).backend.device
          : null,
      () => {
        this.changed = true;
      },
      (why) => {
        this.failure ??= why;
      },
    );
    this.chain = new PassChain({
      renderer: this.renderer,
      canvas: this.canvas,
      square: this.square,
      toClip: () => this.toClip,
      backendName: () => this.backendName,
      compile: (object, target, scene) => this.gpu.compileFor(object, target, scene),
      makeDraws: () => this.makeDraws(),
      changed: () => {
        this.changed = true;
      },
      failed: (error) => {
        this.failed = true;
        this.failure = error instanceof Error ? error.message : String(error);
        console.warn('the background scene is not drawn:', error);
      },
    });
    this.gpu = new GpuDraws({
      renderer: this.renderer,
      camera3: this.camera3,
      square: this.square,
      textures: this.textures,
      started: () => this.started,
      toClip: () => this.toClip,
      skyLight: () => this.chain.skyLightQuarter.texture,
      frame: () => this.chain.frame?.colour,
      particleDraws: () => this.particles.flatMap((p) => (p.gpu ? [p.gpu] : [])),
      changed: () => {
        this.changed = true;
      },
      failed: (why) => {
        this.failure ??= why;
      },
    });
    this.bakes = new BodyBaker({
      renderer: this.renderer,
      camera3: this.camera3,
      canvas: this.canvas,
      gpu: this.gpu,
      chain: this.chain,
      camera: () => this.camera,
      view: () => this.view,
      viewVersion: () => this.viewVersion,
      skyVersion: () => this.skyVersion,
      surfacesKey: () => this.surfacesKey,
      surfaces: () => this.surfaces,
      sceneThreshold: () => this.sceneThreshold(),
      placed: () => this.placed,
      dim: () => this.dim,
    });
    this.aids = new EditingAids({
      renderer: this.renderer,
      camera3: this.camera3,
      square: this.square,
      toClip: () => this.toClip,
      depth: () => this.chain.frame?.colour.depthTexture,
      compile: (mesh, scene) => this.gpu.compileFor(mesh, null, scene),
      changed: () => {
        this.changed = true;
      },
      failed: (why) => {
        this.failure ??= why;
      },
    });
    const { scene } = loaded;
    this.referenceView = viewMatrix(scene.camera.eye, scene.camera.forward, scene.camera.up);
    this.layout = { eye: scene.camera.eye, forward: scene.camera.forward, up: scene.camera.up };
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
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]),
          3,
        ),
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
        const backend = (
          this.renderer as unknown as { backend: { isWebGPUBackend?: boolean; device?: GPUDevice } }
        ).backend;
        if (backend.isWebGPUBackend) {
          this.toClip = (clip) => vec4(clip.x, clip.y, clip.z.add(clip.w).mul(0.5), clip.w);
          // (Its pipeline first: the first images' mipmaps wait on it.)
          prepareMipmaps(backend.device!);
        }
        this.started = true;
        this.chain.allocateAll();
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
    const backend = (this.renderer as unknown as { backend: { isWebGPUBackend?: boolean } })
      .backend;
    return backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  }

  /**
   * The planets put up in the scene, replacing those there were: their textures are taken the first
   * time each planet is placed. A body put up as it was (the same placement) keeps what is worked
   * out and baked of it; only the others are worked out again.
   */
  setBodies(bodies: readonly DrawnBody[]): void {
    const { eye } = this.camera;
    const up = this.viewUpNow();
    let loaded = false;
    for (const body of bodies)
      for (const planet of body.files) {
        if (this.planetsLoaded.has(planet)) continue;
        for (const [key, image] of Object.entries(planet.images))
          if (!this.textures.has(key)) {
            this.textures.add(key, image);
            loaded = true;
          }
        this.planetsLoaded.add(planet);
      }
    if (loaded) this.resolveSky();
    const previous = this.placed;
    const before = new Map(previous.map((p) => [p.body, p]));
    const kept = new Set<Placed>();
    this.placed = bodies.map((body, i) => {
      // The same body: its placement, or (edited: a new placement) the same planet wearing the
      // same overlays, at the same place in the list, else anywhere in it not already taken (a fly
      // ending: the planets flown to were after those flown from, and moved, so new placements).
      // Its id kept, so its draws are (`gpuOf` finds them: an edit is uniforms, nothing built),
      // and its bake shown till the next is whole: nothing flickers out while it is built again.
      const alike = (p: Placed | undefined) =>
        !!p &&
        !kept.has(p) &&
        p.body.files.length === body.files.length &&
        p.body.files.every((f, k) => f === body.files[k]);
      const at = previous[i];
      const exact = before.get(body);
      const keep =
        (exact && !kept.has(exact) ? exact : undefined) ??
        (alike(at) ? at : undefined) ??
        previous.find(alike);
      if (keep) kept.add(keep);
      if (keep && keep.body === body && !loaded) return keep;
      const placed: Placed = {
        id: keep?.id ?? nextPlacedId++,
        body,
        quad: bodyFrame(body.position, body.radius, eye, up),
        placementFrame: placementFrame(body.position, this.layout),
        extent: 0,
        states: [],
        version: keep?.version ?? 0,
        reachOf: 0,
        hasShapes: false,
        bake: keep?.bake ?? null,
      };
      // (Measured once its draws are worked out: how far a part reaches depends on which way it is turned.)
      this.resolveBody(placed);
      this.measure(placed);
      return placed;
    });
    for (const gone of previous) if (!kept.has(gone)) this.forget(gone);
    this.updateSurfaces();
    this.changed = true;
  }

  /** A body no longer put up: its bake and its draws' GPU sides freed. */
  private forget(placed: Placed): void {
    if (this.placed.some((p) => p.id === placed.id)) return;
    this.bakes.freeBake(placed.bake);
    for (const [key, gpu] of this.gpu.gpuDraws)
      if (key.startsWith(`body:${placed.id}:`)) {
        this.gpu.release(gpu);
        this.gpu.gpuDraws.delete(key);
      }
    this.gpu.bodyScenes.delete(placed.id);
  }

  private measure(placed: Placed): void {
    const { position, radius } = placed.body;
    const list = placed.body.parts;
    const parts = list.map((p) => p.part);
    // Its parts not square to the eye (any of their materials fixed in the world, or turned by
    // the body's own turn): a ring of them tilts.
    const turned = !isIdentity(placed.body.turn);
    const world = new Set(
      placed.states
        .filter((s) => s.orientation === 'world' || (turned && s.turned))
        .map((s) => s.draw.part),
    );
    const standing = new Set(list.filter((p) => world.has(p.source)).map((p) => p.part));
    placed.extent = partsExtent(radius, parts, distance(position, this.camera.eye), standing);
    placed.reachOf = reach(parts) * radius;
    placed.hasShapes = parts.some((p) => p.shape.kind !== 'sphere' && p.shape.kind !== 'ring');
  }

  private resolveBody(placed: Placed): void {
    const { body } = placed;
    const draws = body.draws.map((d): MeshDraw => {
      const material = this.material(d.name, `${d.file.id}/${d.index}`, d.file.planet.materials);
      return {
        name: d.name,
        key: d.key,
        ...(d.overlay ? { overlay: d.overlay } : {}),
        material,
        moving: moves(material),
        placed,
        owner: d.file,
        part: d.source,
        partKey: d.partKey,
        ...(body.rig ? { light: body.rig } : {}),
        id: `body:${placed.id}:${d.file.id}:${d.index}:${d.name}`,
        bodyDraw: d,
      };
    });
    placed.states = withoutHidden(
      sorted(
        draws.map((d) => drawStateOf(d, this.drawContext)),
        () => placed.body.order,
      ),
    );
    placed.version++;
  }

  private resolveSky(): void {
    const states = [...this.sceneDraws, ...this.skyOverlayDraws].map((d) =>
      drawStateOf(d, this.drawContext),
    );
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

  // --- The GPU side of draws ----------------------------------------------------------------

  /**
   * Every draw the first picture has, made at once (its programs then all compiled side by side,
   * with the passes'): the sky's, the bodies' up and the particles' (those whose textures are
   * ready), and the keepers (every program they need, ready or not).
   */
  private makeDraws(): void {
    for (const blend of BLEND_KINDS) this.gpu.keep(true, blend, 'scene', this.square);
    for (const s of this.skyStates)
      if (s.enabled) this.gpu.keep(false, s.blend, s.depth, s.draw.geometry ?? this.square);
    for (const s of this.skyStates) if (s.enabled) this.gpu.gpuOf(s);
    for (const body of this.placed)
      for (const s of body.states) if (s.enabled && s.part) this.gpu.gpuOf(s);
    for (const p of this.particles)
      this.particleGpu(p, this.depthOf(p.name, this.sky.materials?.[p.name], false));
  }

  /** The sky's GPU draws, each state's (made where missing); null while any isn't compiled yet. */
  private skyReady(): boolean {
    let ready = true;
    for (const s of this.skyStates) {
      if (!s.enabled) continue;
      const g = this.gpu.gpuOf(s);
      if (!g?.ready) ready = false;
    }
    return ready;
  }

  // --- Picking and placing -------------------------------------------------------------------

  /**
   * The placed planet under a point of the view (`x`, `y`: shares of its width and height; the
   * view `aspect` wide), by its index in what was put up (`setPlanets`); the nearest where they
   * overlap; null where there is none. Its body counts, not its halo; one hidden or dimmed (in
   * the background of what is edited) is not picked.
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
    this.placed.forEach(({ body }, index) => {
      if (body.hidden || body.dimmed) return;
      const { position, radius } = body;
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
   * (`top`: over its axis's poles' names too, where its axis is shown), as shares of the view's
   * width and height from the top left; none for one behind the eye.
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
    for (const { body, quad } of this.placed) {
      const { position, radius } = body;
      const centre = project(position);
      // Its top on the screen: up its frame facing the eye (turned to the view's up), not the world's.
      const z = quad.axes.subarray(6, 9);
      const top = project([
        position[0] + z[0]! * radius,
        position[1] + z[1]! * radius,
        position[2] + z[2]! * radius,
      ]);
      // Over its axis's poles' names too, where its axis is shown (not to sit on them).
      const names = this.aids.beams
        .filter((a) => a.shape === 'axis' && a.centre.every((c, k) => c === position[k]))
        .flatMap((a) => (a.shape === 'axis' ? Object.values(axisEnds(a, AXIS_NAMES_PAST)) : []))
        .map((p) => project(p)?.[1] ?? 1);
      if (centre && top)
        out.push({
          id: body.label ?? body.id,
          x: centre[0],
          y: centre[1],
          top: Math.min(top[1], ...names),
        });
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
      const position = positions[i] ?? placed.body.position;
      const radius = radii?.[i] ?? placed.body.radius;
      const was = placed.body;
      if (position === was.position && radius === was.radius && seen) return;
      placed.body = { ...was, position, radius };
      placed.quad = bodyFrame(position, radius, eye, up);
      if (position !== was.position) placed.placementFrame = placementFrame(position, this.layout);
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
    this.placePlanets(this.placed.map((p) => p.body.position));
    this.stillDirty = true;
    this.viewChanged();
  }

  /** The camera turned about its up from where the scene puts it, in radians. */
  setYaw(yaw: number): void {
    if (yaw === this.yaw) return;
    this.yaw = yaw;
    this.view = this.viewNow();
    this.placePlanets(this.placed.map((p) => p.body.position)); // turned with the view
    this.stillDirty = true;
    this.viewChanged();
  }

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
      Infinity,
    );
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
    // (The same size again, as a panel's edge dragged less than a pixel gives: nothing to do.)
    if (this.started && w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.renderer.setSize(w, h, false);
    this.view = this.viewNow();
    this.projection = this.projectionNow();
    if (this.started) this.chain.allocateAll();
    this.stillDirty = true;
    this.viewChanged();
  }

  // --- Targets and passes ---------------------------------------------------------------------
  /** Whether a picture has been drawn (see `draw`). */
  private drawnOnce = false;

  private sceneThreshold(): number {
    return this.loaded.scene.tone.bloomThreshold ?? DEFAULT_BLOOM_THRESHOLD;
  }

  private drawStill(): void {
    const background = this.chain.stillBackground!;
    const scene = this.chain.stillScene!;
    for (const output of OUTPUTS) {
      this.chain.clear(this.chain.target(background, output), this.backdrop ? 0 : 1);
      this.drawMeshes(0, 'background', output, false);
      this.chain.clear(this.chain.target(scene, output), 0);
      this.drawMeshes(0, 'scene', output, false);
    }
    this.chain.clear(this.chain.skyLight, 0);
    this.chain.passes!.composite.get('skyBackground')!.render(this.renderer);
    this.chain.passes!.composite.get('skyScene')!.render(this.renderer);
    // Its mipmaps one and two (the bodies' sky lights read the second).
    this.renderer.setRenderTarget(this.chain.skyLightHalf);
    this.chain.passes!.downsample[0].render(this.renderer);
    this.renderer.setRenderTarget(this.chain.skyLightQuarter);
    this.chain.passes!.downsample[1].render(this.renderer);
    this.skyVersion++;
    // (A still draw being made again, or waiting on its textures, was left out: drawn again once it is ready.)
    this.stillDirty = this.skyStates.some(
      (s) => s.enabled && !s.moving && !this.gpu.gpuOf(s)?.ready,
    );
  }

  // --- Settings --------------------------------------------------------------------------------

  /**
   * Where a draw is drawn among the scene's objects: a body's among them; a sky material's as set,
   * else as the data puts it, never among them where it isn't anchored to the world.
   */
  private depthOf(
    name: string,
    settings: MaterialSettings | undefined,
    placed: boolean,
  ): MaterialDepth {
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
        return (
          (settings?.enabled ?? MATERIAL_DEFAULTS.enabled) &&
          skyAnchorOf(settings, this.sky.anchor) !== 'world'
        );
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
    if (this.skyStates.some((s) => s.enabled && !s.moving && s.anchor !== 'world'))
      this.stillDirty = true;
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

  private addedTo(body: DrawnBody | undefined): readonly AddedLight[] {
    if (!body) return [];
    return body.added?.length ? [...body.added, ...this.sceneLights] : this.sceneLights;
  }

  /**
   * The sky shown as these settings say (materials not named, as the data has them), wearing the
   * overlays they say (none given: its data's), each part placed as its settings say.
   */
  setSky(sky: DrawnSky): void {
    this.sky = sky;
    this.placeSkyOverlays();
    this.resolveSky();
  }

  private placeSkyOverlays(): void {
    const scene = this.loaded.scene;
    const { worn } = this.sky;
    const key = JSON.stringify([
      worn.map(({ id, file }) => [id, fileId(file)]),
      this.sky.parts ?? null,
    ]);
    if (key === this.skyOverlayKey) return;
    this.skyOverlayKey = key;
    const oldGeometries = this.skyOverlayGeometries;
    const oldDraws = this.skyOverlayDraws;
    this.skyOverlayGeometries = [];
    this.skyOverlayDraws = [];
    for (const { images } of worn)
      for (const [textureKey, image] of Object.entries(images ?? {}))
        this.textures.add(textureKey, image);
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
      const gpu = this.gpu.gpuDraws.get(d.id);
      if (gpu && d.geometry) gpu.mesh.geometry = d.geometry;
    }
    for (const d of oldDraws) if (!ids.has(d.id)) this.gpu.dropGpu(d.id);
    for (const g of oldGeometries) g.dispose();
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
    return this.placed.some((b) => this.bakes.bakeDue(b, seconds));
  }

  /** The GPU's times for the frames drawn since last asked (ms), where it can be timed. */
  gpuTimes(): number[] {
    return this.gpuTimesMs.splice(0);
  }

  frameSections(): FrameSections[] {
    return this.sections.splice(0);
  }

  /** How many bodies are up (not hidden), and how many of them are baked whole (the renderer check). */
  bodyCounts(): { placed: number; baked: number } {
    const up = this.placed.filter((b) => !b.body.hidden);
    return { placed: up.length, baked: up.filter((b) => b.bake?.complete).length };
  }

  /** Resolves once the GPU has done all the work sent to it so far (the renderer check). */
  gpuDone(): Promise<void> {
    const backend = (
      this.renderer as unknown as {
        backend: { isWebGPUBackend?: boolean; device?: GPUDevice; gl?: WebGL2RenderingContext };
      }
    ).backend;
    if (backend.isWebGPUBackend && backend.device)
      return backend.device.queue.onSubmittedWorkDone();
    return backend.gl ? fenced(backend.gl) : Promise.resolve();
  }

  /** Whether three.js is still starting, a program compiling, or a body's bake waiting for one. */
  get settling(): boolean {
    if (this.failed) return false;
    return (
      !this.started ||
      !this.chain.passesReady ||
      this.gpu.compiling > 0 ||
      !this.skyReady() ||
      this.placed.some((b) => !b.body.hidden && (b.bake === null || !b.bake.complete))
    );
  }

  // --- Drawing --------------------------------------------------------------------------------

  /** The scene at `seconds` on its clock; nothing until three.js is up and the sky's programs have compiled (false). */
  draw(seconds: number): boolean {
    if (!this.started || !this.chain.frame || !this.chain.passes || !this.chain.passesReady)
      return false;
    // The first picture waits for the whole sky; after it, a sky draw being made again (another
    // texture, blend or depth) is left out till it is ready, the rest drawn.
    if (!this.skyReady() && !this.drawnOnce) return false;
    const r = this.renderer;
    const { width, height } = this.canvas;
    const now = this.timing ? () => performance.now() : () => 0;
    r.info.reset();
    const started = now();
    const stillDrawn = this.stillDirty;
    if (stillDrawn) this.drawStill();
    const stillDone = now();
    const viewProjection = multiply(this.projection, this.view);
    let baked = 0;
    for (const body of this.placed)
      if (this.bakes.bakeDue(body, seconds)) {
        this.bakes.bakeBody(body, seconds, viewProjection);
        baked++;
      }
    const bakesDone = now();
    for (const output of OUTPUTS) {
      const colour = output === 'colour';
      r.setRenderTarget(this.chain.target(this.chain.frame, output));
      this.chain.passes.copy.get(output)!.render(r);
      this.drawMeshes(seconds, 'background', output, true);
      if (colour) this.drawParticles(seconds, 'background');
      r.setRenderTarget(this.chain.target(this.chain.frame, output));
      this.chain.passes.composite.get(`scene:${output}`)!.render(r);
      this.chain.passes.copyDepth.get(output)!.render(r);
      this.bakes.compositeBodies(viewProjection, output);
      this.drawMeshes(seconds, 'scene', output, true);
      if (colour) this.drawParticles(seconds, 'scene');
      this.drawMeshes(seconds, 'foreground', output);
      if (colour) this.drawParticles(seconds, 'foreground');
    }
    const passesDone = now();
    this.chain.drawBloom(this.sceneThreshold());
    const tone = this.chain.passes.toneUniforms;
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
    this.chain.passes.tone.render(r);
    this.aids.draw({
      viewProjection,
      eye: this.camera.eye,
      up: this.viewUpNow(),
      fovY: this.camera.fovY,
      height: this.canvas.height,
      width: this.canvas.width,
      forward: [-this.view[2]!, -this.view[6]!, -this.view[10]!],
      near: this.camera.near,
      bodies: this.placed.map(({ body: { position, radius } }) => [...position, radius] as const),
      fade: this.aidFade,
    });
    if (this.timing) {
      this.sections.push({
        stillDrawn,
        still: stillDone - started,
        bakes: bakesDone - stillDone,
        baked,
        resized: this.bakes.takeResizes(),
        passes: passesDone - bakesDone,
        post: now() - passesDone,
        renders: r.info.render.frameCalls,
        calls: r.info.render.drawCalls,
        pipelines:
          (r as unknown as { _pipelines?: { caches?: Map<string, unknown> } })._pipelines?.caches
            ?.size ?? 0,
        textures: r.info.memory.textures,
        textureMb: r.info.memory.texturesSize / 1e6,
        width,
        height,
        backend: this.backendName ?? '',
      });
      void r.resolveTimestampsAsync().then((ms) => {
        if (typeof ms === 'number' && ms > 0) this.gpuTimesMs.push(ms);
      });
    }
    this.changed = false;
    this.drawnOnce = true;
    // (The editor's aids once the whole picture is up: see `EditingAids.compile`.)
    if (!this.placed.some((b) => !b.body.hidden && !b.bake?.complete)) this.aids.compile();
    return true;
  }

  /** The sky's draws at a depth (those that move, or those that don't; the foreground's all) into the bound target's pass. */
  private drawMeshes(
    seconds: number,
    depth: MaterialDepth,
    output: Output,
    moving?: boolean,
  ): void {
    if (this.backdrop) return;
    const states = this.skyStates.filter(
      (s) => s.enabled && s.depth === depth && (moving === undefined || s.moving === moving),
    );
    if (!states.length) return;
    // Each anchor's view (see `skyView`), and where the eye is for it and its axes, in the sky's
    // own space (where its meshes' points are): what a draw is shaded from.
    const seen = new Map<
      SkyAnchor,
      { viewProjection: Float32Array; eye: Vec3; right: Vec3; up: Vec3 }
    >();
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
    for (const g of this.gpu.gpuDraws.values()) g.mesh.visible = false;
    states.forEach((s, order) => {
      const g = this.gpu.gpuOf(s);
      if (!g?.ready) return;
      const u = g.uniforms;
      const view = seenAs(s.anchor);
      u.set('uViewProjection', view.viewProjection);
      u.set('uSceneThreshold', threshold);
      u.set('uGlowThreshold', threshold);
      u.set('uPattern', 0);
      u.set('uDim', this.dim);
      u.set('uShadeCount', 0);
      u.apply(tint);
      u.set('uRimTurn', [0, 0]);
      u.set('uEye', view.eye);
      u.set('uRight', view.right);
      u.set('uUp', view.up);
      u.set('uSmear', this.smear);
      u.set('uLit', 0);
      u.set('uOutput', output === 'glow' ? 1 : 0);
      for (const { slot, layer } of s.scrolls)
        u.set(`uLayers[${slot}].offset`, layerOffset(layer, seconds));
      g.mesh.renderOrder = order;
      g.mesh.visible = true;
    });
    // The target is the frame's, or a still target's: whichever is bound.
    this.renderer.render(this.gpu.skyScene, this.camera3);
    for (const s of states) {
      const g = this.gpu.gpuDraws.get(s.draw.id);
      if (g) g.mesh.visible = false;
    }
  }

  private drawParticles(seconds: number, depth: MaterialDepth): void {
    if (this.backdrop) return;
    const list = this.particles.filter(
      (p) => this.depthOf(p.name, this.sky.materials?.[p.name], false) === depth,
    );
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
      u.set('uDim', this.dim);
      u.apply(tint);
      u.set('uChannel', CHANNELS[layer.channel ?? 'rgb']);
      u.set(
        'uBright',
        layerBrightness(layer.brightMult) * (settings?.strength ?? MATERIAL_DEFAULTS.strength),
      );
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
    const tex = this.textures.sampledTexture(layer.texture, layer.wrap);
    if (!tex) return null;
    if (p.gpu) this.gpu.release(p.gpu);
    const uniforms = new ShaderUniforms();
    const material = particleMaterial(uniforms, tex, this.toClip, depth === 'scene');
    const mesh = new Mesh(p.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.particleScene.add(mesh);
    p.gpu = { mesh, uniforms: uniforms.values, depth, ready: false, state: 'particle' };
    this.gpu.requestCompile();
    return p.gpu;
  }

  /**
   * The last frame's picture as shown (tone-mapped; no beams), top row first, RGBA: for the
   * renderer check, which compares the picture drawn on WebGPU with the one drawn on WebGL 2.
   */
  readPixels(): Promise<Uint8Array> {
    return this.chain.readPixels();
  }

  /** Beams to show over the picture (none: none); drawn at the next frame. */
  setBeams(beams: readonly EditingAid[]): void {
    if (this.aids.set(beams)) this.changed = true;
  }

  /** Free what the GPU holds. */
  dispose(): void {
    for (const g of this.gpu.gpuDraws.values()) freeGpu(g);
    this.textures.dispose();
    for (const placed of this.placed) this.bakes.freeBake(placed.bake);
    this.chain.dispose();
    this.renderer.dispose();
  }

  private settingsOf(draw: MeshDraw): MaterialSettings | undefined {
    return draw.placed ? draw.bodyDraw?.settings : this.sky.materials[draw.key];
  }

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
        const { position, radius } = placed.body;
        const [x, y, z] = (shape.centre ?? [0, 0, 0]).map((c) => c * radius) as [
          number,
          number,
          number,
        ];
        // Its centre off the body's as its surface is turned (facing the eye, or fixed in the world;
        // by the body's own turn where it takes it).
        const a = surfaceFrame(
          placed.placementFrame,
          placed.quad.axes,
          s.orientation ?? DEFAULT_ORIENTATION,
          turnFor(s, placed.body.turn),
        );
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
}
