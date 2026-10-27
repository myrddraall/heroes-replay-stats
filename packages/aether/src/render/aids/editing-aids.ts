import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  type NodeMaterial,
  type PerspectiveCamera,
  type PlaneGeometry,
  Scene,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  BEAM_LENGTH,
  beamAcross,
  beamTube,
  type EditingAid,
  type LightOutline,
  OUTLINE_EXTENT,
} from '../../aids/beams';
import { bodyFrame } from '../../space/space';
import type { AidKind } from '../draw-types';
import { MAX_BEAM_SPHERES } from '../uniforms/limits';
import { beamMaterial, outlineMaterial } from './aid-shaders';
import type { ToClip } from '../passes/pass-shaders';
import { ShaderUniforms } from '../uniforms/shader-uniforms';
import { UniformSet } from '../uniforms/uniforms';
import { type Vec3, distance, normalize } from '../vectors';

/** How strongly a beam shows down its middle, by its body: one that lights, one that darkens. */
const BEAM_ALPHA = 0.35;
const DARK_BEAM_ALPHA = 0.7;
/** How strongly a dark beam's edges show. */
const BEAM_EDGE_ALPHA = 0.5;
/** How strongly a light's outline on its body shows. */
const OUTLINE_ALPHA = 0.85;

/** What the editor's aids need of the renderer they are drawn over. */
export interface AidsHost {
  readonly renderer: WebGPURenderer;
  readonly camera3: PerspectiveCamera;
  /** The camera-facing square an outline is drawn on. */
  readonly square: PlaneGeometry;
  /** Clip space into the API's (as the backend has it once started). */
  toClip(): ToClip;
  /** The depth of the picture drawn: an aid is hidden where it is nearer (none: none drawn yet). */
  depth(): Texture | null | undefined;
  /** Its program compiled, for the canvas, in a scene of its own. */
  compile(mesh: Mesh, scene: Scene): Promise<void>;
  /** The aids can be drawn now: draw again. */
  changed(): void;
  failed(why: string): void;
}

/** Where the aids are drawn from, this frame. */
export interface AidView {
  readonly viewProjection: Float32Array;
  readonly eye: Vec3;
  readonly up: Vec3;
  /** The camera's vertical field of view, in degrees, and the canvas's height in pixels. */
  readonly fovY: number;
  readonly height: number;
  /** The bodies an aid can be hidden behind: each its centre and radius. */
  readonly bodies: readonly (readonly [number, number, number, number])[];
  /** How strongly they show, 0 to 1. */
  readonly fade: number;
}

/**
 * The editor's aids over the picture: lights' beams and outlines, planets' axes. They are drawn in
 * the canvas after the picture (as it is shown, whatever the scene's light), each hidden where the
 * picture is nearer.
 */
export class EditingAids {
  private shown: readonly EditingAid[] = [];
  /** The aids' draws by kind, made as more are wanted and kept (one of each made and compiled at the start). */
  private readonly pool = new Map<AidKind, { mesh: Mesh; uniforms: ShaderUniforms }[]>();
  private readonly geometry = new BufferGeometry();
  private readonly scene = new Scene();
  /** Whether their programs are asked for, and whether they have compiled (none is drawn until they have: see `compile`). */
  private asked = false;
  private ready = false;

  constructor(private readonly host: AidsHost) {
    this.geometry.setAttribute('position', new BufferAttribute(beamTube(), 3));
  }

  /** The aids shown. */
  get beams(): readonly EditingAid[] {
    return this.shown;
  }

  /**
   * One of each of the editor's aids (drawn over the picture, in the canvas) compiled once the
   * whole picture is up (none is wanted before it, and compiled with the rest they would hold the
   * picture up: WebGPU builds pipelines only so many at a time), so one shown later has its
   * program at once.
   */
  compile(): void {
    if (this.asked) return;
    this.asked = true;
    const compiled = (['outline', 'light', 'dark', 'edge'] as const).map((kind) => {
      const scene = new Scene();
      const { mesh } = this.aid(kind, 0);
      scene.add(mesh);
      return this.host.compile(mesh, scene).then(() => void scene.clear());
    });
    void Promise.all(compiled).then(
      () => {
        this.ready = true;
        this.host.changed();
      },
      (error: unknown) => {
        this.host.failed(
          `an editing aid's program failed to compile: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn("an editing aid's program failed to compile:", error);
      },
    );
  }

  /** The aids to show over the picture (none: none); whether they changed (drawn at the next frame). */
  set(beams: readonly EditingAid[]): boolean {
    if (beams === this.shown) return false;
    this.shown = beams;
    return true;
  }

  /** The n-th of an aid kind's draws (made where there aren't that many yet). */
  private aid(kind: AidKind, n: number): { mesh: Mesh; uniforms: ShaderUniforms } {
    let pool = this.pool.get(kind);
    if (!pool) this.pool.set(kind, (pool = []));
    while (pool.length <= n) {
      const uniforms = new ShaderUniforms();
      const depth = this.host.depth()!;
      const material =
        kind === 'outline'
          ? outlineMaterial(uniforms, depth, this.host.toClip())
          : beamMaterial(uniforms, depth, kind, this.host.toClip());
      pool.push({
        mesh: this.mesh(kind === 'outline' ? this.host.square : this.geometry, material),
        uniforms,
      });
    }
    return pool[n]!;
  }

  /**
   * The beams and outlines over the picture as shown (after its exposure and bloom: as they are
   * whatever the scene's light), each hidden where the frame's depth is nearer; one that lights
   * adds its colour, one that darkens takes it away.
   */
  draw(view: AidView): void {
    if (!this.shown.length || !this.host.depth() || !this.ready || view.fade <= 0) return;
    const { eye, viewProjection } = view;
    const spheres = [...view.bodies]
      .sort((a, b) => distance([a[0], a[1], a[2]], eye) - distance([b[0], b[1], b[2]], eye))
      .slice(0, MAX_BEAM_SPHERES);
    const shared = new UniformSet();
    shared.m4('uViewProjection', viewProjection);
    shared.v3('uEye', eye);
    shared.i1('uSphereCount', spheres.length);
    shared.fv(
      'uSurfaces',
      [...spheres.flat(), ...Array<number>((MAX_BEAM_SPHERES - spheres.length) * 4).fill(0)],
      '4fv',
    );
    const used = new Map<AidKind, number>();
    const next = (kind: AidKind) => {
      const n = used.get(kind) ?? 0;
      used.set(kind, n + 1);
      return this.aid(kind, n);
    };
    const outlines: Mesh[] = [];
    const beams: Mesh[] = [];
    const rad = Math.PI / 180;
    for (const aid of this.shown) {
      if (aid.shape === 'outline') {
        const o = aid as LightOutline;
        const { mesh, uniforms } = next('outline');
        outlines.push(mesh);
        uniforms.apply(shared);
        uniforms.set('uCentre', o.centre);
        // Its square facing the eye; the light it outlines placed as its body is lit (`o.axes`).
        uniforms.set('uAxes', bodyFrame(o.centre, o.radius, eye, view.up).axes);
        uniforms.set('uLightAxes', o.axes);
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
        uniforms.set('uAlpha', OUTLINE_ALPHA * view.fade);
        continue;
      }
      if (aid.shape === 'axis') {
        // A planet's axis: each half a thin beam (a light's beam's program) from its middle out
        // to its end, as strong all along, as many pixels thick wherever it is, hidden by its own
        // sphere only where the sphere is in front of it (among `uSurfaces`), not wherever it is
        // over the sphere as a light's beam is (`uBody` none).
        const pixel =
          (2 * distance(aid.centre, eye) * Math.tan((view.fovY * Math.PI) / 360)) / view.height;
        for (const [sign, colour] of [
          [1, aid.north],
          [-1, aid.south],
        ] as const) {
          const way = normalize(aid.way.map((v) => v * sign) as unknown as Vec3);
          const [across, up] = beamAcross(way);
          const { mesh, uniforms } = next('light');
          beams.push(mesh);
          uniforms.apply(shared);
          uniforms.set('uCentre', aid.centre);
          uniforms.set('uBody', [...aid.centre, 0]);
          uniforms.set('uWay', way);
          uniforms.set('uAcross', across);
          uniforms.set('uUp', up);
          uniforms.set('uRadius', (aid.pixels / 2) * pixel);
          uniforms.set('uLength', aid.reach * aid.radius);
          uniforms.set('uColor', colour);
          uniforms.set('uAlpha', aid.strength * view.fade);
          uniforms.set('uFade', 0);
        }
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
        uniforms.set(
          'uAlpha',
          (kind === 'dark' ? DARK_BEAM_ALPHA : kind === 'edge' ? BEAM_EDGE_ALPHA : BEAM_ALPHA) *
            view.fade,
        );
        uniforms.set('uFade', 1);
      }
    }
    // Outlines first, then the beams over them.
    this.host.renderer.setRenderTarget(null);
    for (const mesh of [...outlines, ...beams]) {
      this.scene.add(mesh);
      this.host.renderer.render(this.scene, this.host.camera3);
      this.scene.remove(mesh);
    }
  }

  private mesh(geometry: BufferGeometry, material: NodeMaterial): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}
