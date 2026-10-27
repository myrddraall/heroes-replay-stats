import {
  type BufferGeometry,
  FrontSide,
  type Material,
  Mesh,
  NodeMaterial,
  type PerspectiveCamera,
  type PlaneGeometry,
  type RenderTarget,
  Scene,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';
import type { SceneBlend } from '../formats/play-scene';
import type { MaterialDepth } from '../materials/material-settings';
import {
  type DrawState,
  type GpuDraw,
  type ParticleDraw,
  type Placed,
  type Releasable,
  sharedKey,
} from './draw-types';
import { freeGpu } from './gpu';
import type { SceneTextures } from './textures/scene-textures';
import { coldVertex } from './cold-shaders';
import { bodyNodes } from './bodies/body-shader';
import { type Slot, SLOTS, TextureSlots } from './materials/material-shader';
import { meshNodes } from './meshes/mesh-shader';
import { type PassQuad, setBlend, type ToClip } from './passes/pass-shaders';
import { DrawValues, ShaderUniforms, withValues } from './uniforms/shader-uniforms';

/** What the draws' GPU side needs of the renderer. */
export interface GpuDrawsHost {
  readonly renderer: WebGPURenderer;
  readonly camera3: PerspectiveCamera;
  /** The camera-facing square a draw with no geometry of its own is drawn on. */
  readonly square: PlaneGeometry;
  readonly textures: SceneTextures;
  /** Whether three.js is up (its backend chosen and started). */
  started(): boolean;
  /** Clip space into the API's (as the backend has it once started). */
  toClip(): ToClip;
  /** The small sky light the bodies are lit by. */
  skyLight(): Texture;
  /** The frame's colour target, the draws' programs compiled for (none before it is made). */
  frame(): RenderTarget | null | undefined;
  /** The particles' draws, compiled with the rest. */
  particleDraws(): NonNullable<ParticleDraw['gpu']>[];
  /** A draw is ready, or compiling ended: draw again. */
  changed(): void;
  failed(why: string): void;
}

/**
 * The draws' GPU side: each draw's mesh and values on its kind's shared material, in the scene it
 * is drawn from, and their programs compiled in the background, side by side, each draw ready once
 * its program is.
 */
export class GpuDraws {
  constructor(private readonly host: GpuDrawsHost) {}

  /** Each draw's GPU side, by its draw's id. */
  readonly gpuDraws = new Map<string, GpuDraw>();
  /** The scenes the draws are drawn from: the sky's, and each body's (by its id). */
  readonly skyScene = new Scene();
  readonly bodyScenes = new Map<number, Scene>();
  /** How many batches of programs are compiling, and whether one is asked for (see `requestCompile`). */
  compiling = 0;
  private compileAsked = false;
  /** Each shader and state's compiles in flight, and its draws compiled meanwhile (ready when none is). */
  private readonly inFlight = new Map<
    string,
    { count: number; done: (Releasable & { ready: boolean; replaces?: Releasable })[] }
  >();
  /** Each kind of draw's material, for each blend and depth, shared by its draws (see `sharedMaterial`). */
  private readonly sharedMaterials = new Map<string, NodeMaterial>();
  /**
   * A draw of each shared material, with placeholder textures, kept for the renderer's life (by
   * its material's key): a body's for each blend it can be drawn with, a sky mesh's for each its
   * sky has. Each compiles its material's program at once, whether its draws' textures are ready
   * or not, and holds it (three.js lets go of a program, and of a material's built shader, once
   * none of its meshes use it), so a new set of planets builds and compiles nothing.
   */
  readonly keepers = new Map<string, GpuDraw>();
  readonly keeperScene = new Scene();
  /** The materials three.js has built the shader of (a draw of theirs compiled), and those whose first compile is under way. */
  private readonly built = new WeakSet<Material>();
  private readonly building = new WeakSet<Material>();

  /**
   * A state's GPU side: the one kept for its draw if it was made for the same kind of draw, blend,
   * depth and textures (its values then the state's), else one made anew, with its kind's shared
   * material, whose program is compiled (see `keepers`). None while its textures' mipmaps are
   * being made.
   */
  gpuOf(s: DrawState): GpuDraw | null {
    if (!this.host.started()) return null;
    const body = !!s.part;
    const textures = this.host.textures.of(s);
    if (!textures) return null;
    const key = JSON.stringify([
      body ? 'body' : 'mesh',
      s.blend,
      s.depth,
      SLOTS.map((slot) => textures[slot].uuid),
    ]);
    let gpu = this.gpuDraws.get(s.draw.id);
    if (!gpu || gpu.key !== key) {
      const old = gpu;
      const scene = s.draw.placed ? this.bodyScene(s.draw.placed) : this.skyScene;
      gpu = this.drawOf(
        key,
        body,
        s.blend,
        s.depth,
        textures,
        s.draw.geometry ?? this.host.square,
        scene,
      );
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
    const slots = new TextureSlots(
      uniforms,
      this.host.textures.slotPlaceholders,
      this.host.skyLight(),
    );
    material = new NodeMaterial();
    const nodes = (body ? bodyNodes : meshNodes)(uniforms, slots, this.host.toClip());
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
  bodyScene(placed: Placed): Scene {
    let scene = this.bodyScenes.get(placed.id);
    if (!scene) this.bodyScenes.set(placed.id, (scene = new Scene()));
    return scene;
  }
  /**
   * The programs not compiled yet compiled soon: every draw made in the same task (a frame, a set of
   * planets) asked for together, after it, so they all compile side by side.
   */
  requestCompile(): void {
    if (this.compileAsked) return;
    this.compileAsked = true;
    queueMicrotask(() => {
      this.compileAsked = false;
      this.compileWaiting();
    });
  }
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
    const frame = this.host.frame();
    if (!frame) return;
    const first = new Set<Material>();
    const waiting = [
      ...this.keepers.values(),
      ...this.gpuDraws.values(),
      ...this.host.particleDraws(),
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
      const done = this.compileFor(g.mesh, frame, g.mesh.parent as Scene | null);
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
        this.host.changed();
      };
      return done.then(settle, (error: unknown) => {
        settle();
        throw error;
      });
    });
    void Promise.all(compiled).then(
      () => {
        this.compiling--;
        this.host.changed();
      },
      (error: unknown) => {
        this.compiling--;
        this.host.failed(
          `a program failed to compile: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn('a background program failed to compile:', error);
      },
    );
  }
  /**
   * An object's programs compiled ahead for a target, as drawing it there would: three.js's
   * compile takes the renderer's own depth setting for the target's, so it is set to the target's
   * (else a target with no depth gets a pipeline with one, and drawing makes another at once).
   */
  compileFor(object: Mesh, target: RenderTarget | null, scene: Scene | null = null): Promise<void> {
    const r = this.host.renderer;
    const depth = r.depth;
    r.depth = target ? target.depthBuffer : depth;
    r.setRenderTarget(target);
    const done = scene
      ? r.compileAsync(object, this.host.camera3, scene)
      : r.compileAsync(object, (object as PassQuad).camera ?? this.host.camera3);
    r.setRenderTarget(null);
    r.depth = depth;
    return done.then(() => undefined);
  }
  /** A shared material's keeper (see `keepers`), made where it has none: drawn with a geometry like its draws'. */
  keep(body: boolean, blend: SceneBlend, depth: MaterialDepth, geometry: BufferGeometry): void {
    const key = sharedKey(body, blend, depth);
    if (this.keepers.has(key)) return;
    this.keepers.set(
      key,
      this.drawOf(
        `keeper:${key}`,
        body,
        blend,
        depth,
        this.host.textures.slotPlaceholders,
        geometry,
        this.keeperScene,
      ),
    );
  }
  dropGpu(id: string): void {
    const gpu = this.gpuDraws.get(id);
    if (!gpu) return;
    this.release(gpu);
    this.gpuDraws.delete(id);
  }
  /**
   * A draw let go of: out of its scene now, freed once its compile is done (freed while three.js
   * builds it, its build would go on and leak).
   */
  release(gpu: Releasable): void {
    gpu.mesh.removeFromParent();
    if (gpu.compiling) gpu.dropped = true;
    else freeGpu(gpu);
  }
}
