import {
  BufferAttribute,
  BufferGeometry,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  type NodeMaterial,
  type PerspectiveCamera,
  type PlaneGeometry,
  Scene,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  type AidDot,
  type AidLine,
  BEAM_LENGTH,
  beamAcross,
  beamTube,
  type EditingAid,
  type LightOutline,
  OUTLINE_EXTENT,
} from '../../aids/beams';
import { placementUp } from '../../space/graph';
import { bodyFrame } from '../../space/space';
import { rimTurn } from '../../space/directions';
import type { AidKind, InstancedAidKind } from '../draw-types';
import { MAX_BEAM_SPHERES } from '../uniforms/limits';
import { beamMaterial, dotMaterial, lineMaterial, outlineMaterial } from './aid-shaders';
import type { ToClip } from '../passes/pass-shaders';
import { ShaderUniforms, viewTurn } from '../uniforms/shader-uniforms';
import { UniformSet } from '../uniforms/uniforms';
import { type Vec3, distance, normalized } from '../../space/vectors';

/** How strongly a beam shows down its middle, by its body: one that lights, one that darkens. */
const BEAM_ALPHA = 0.35;
const DARK_BEAM_ALPHA = 0.7;
/** How strongly a dark beam's edges show. */
const BEAM_EDGE_ALPHA = 0.5;
/** How strongly a light's outline on its body shows. */
const OUTLINE_ALPHA = 0.85;

/**
 * A rim's lean (the way it leans: against `direction`, the way it travels, in its body's frame
 * `axes`) in the frame facing the eye at the body (`facing`): x across, y away, z up.
 */
export function rimLeanFacing(
  axes: ArrayLike<number>,
  facing: ArrayLike<number>,
  direction: Vec3,
): Vec3 {
  const world = [0, 1, 2].map(
    (k) => -(axes[k]! * direction[0] + axes[3 + k]! * direction[1] + axes[6 + k]! * direction[2]),
  );
  return [0, 3, 6].map(
    (c) => world[0]! * facing[c]! + world[1]! * facing[c + 1]! + world[2]! * facing[c + 2]!,
  ) as unknown as Vec3;
}

/** A threshold no facing reaches: no line there. */
const NO_LINE = 9;

/**
 * Where a light's outline lines go (see `outlineMaterial`), from what the body's shader does with
 * it: where it stops reaching (`main`: from a side or a point, facing it no less than `-wrap`; a
 * spot's back cut the same), and where it is half as strong (`faint`: from a side, its facing
 * wrapped and sharpened by its softness come to half; a hemisphere, where its colours meet; the
 * sky round the body, facing the eye by `1 - ½^(1/softness)`; the rim, where its spread and
 * softness come to half, none where all of it reaches half or more). A point's and a spot's half
 * is worked out in the shader (its distance in it); the hemisphere, the sky and the rim never stop.
 */
export function outlineAt(o: LightOutline): { readonly main: number; readonly faint: number } {
  const half = Math.pow(0.5, 1 / Math.max(o.softness, 1e-3));
  switch (o.kind) {
    case 0:
      return { main: -o.wrap, faint: (o.wrap + 1) * half - o.wrap };
    case 1:
    case 2:
      return { main: -o.wrap, faint: NO_LINE };
    case 3:
      return { main: NO_LINE, faint: 0 };
    case 4:
      return { main: NO_LINE, faint: 1 - half };
    case 5: {
      const x = o.fade < 1 ? (half - o.fade) / (1 - o.fade) : 0;
      return { main: NO_LINE, faint: x > 0 ? 1 - Math.cbrt(x) : NO_LINE };
    }
    default:
      return { main: NO_LINE, faint: NO_LINE };
  }
}

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
  /** The canvas's width in pixels; the way the camera looks, and how near it sees from. */
  readonly width: number;
  readonly forward: Vec3;
  readonly near: number;
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
  /** The markers' lines and dots: each kind one draw, an instance each (see `drawInstanced`). */
  private readonly instanced = new Map<
    InstancedAidKind,
    { mesh: Mesh; uniforms: ShaderUniforms; geometry: InstancedBufferGeometry; room: number }
  >();
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
    const meshes = [
      ...(['outline', 'light', 'dark', 'edge'] as const).map((kind) => this.aid(kind, 0).mesh),
      ...(['line', 'dot'] as const).map((kind) => this.instancedAid(kind).mesh),
    ];
    const compiled = meshes.map((mesh) => {
      const scene = new Scene();
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

  /** A kind of the markers' draws (made the first time it is wanted). */
  private instancedAid(kind: InstancedAidKind) {
    let found = this.instanced.get(kind);
    if (!found) {
      const uniforms = new ShaderUniforms();
      const depth = this.host.depth()!;
      const material =
        kind === 'line'
          ? lineMaterial(uniforms, depth, this.host.toClip())
          : dotMaterial(uniforms, depth, this.host.toClip());
      const geometry = new InstancedBufferGeometry();
      // A square, its corners (x along a line from 0 to 1, or across a dot from -1; y across).
      const x0 = kind === 'line' ? 0 : -1;
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array([x0, -1, 0, 1, -1, 0, 1, 1, 0, x0, 1, 0]), 3),
      );
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      found = { mesh: this.mesh(geometry, material), uniforms, geometry, room: 0 };
      this.roomFor(kind, found, 1);
      this.instanced.set(kind, found);
    }
    return found;
  }

  /** Room in a kind's instances for `n` (made again, twice as big, when there isn't). */
  private roomFor(
    kind: InstancedAidKind,
    draw: { geometry: InstancedBufferGeometry; room: number },
    n: number,
  ): Float32Array {
    const names =
      kind === 'line' ? ['lineFrom', 'lineTo', 'lineColour'] : ['dotAt', 'dotSize', 'dotColour'];
    if (n > draw.room) {
      draw.room = Math.max(16, draw.room * 2, n);
      const buffer = new InstancedInterleavedBuffer(new Float32Array(draw.room * 12), 12);
      names.forEach((name, k) =>
        draw.geometry.setAttribute(name, new InterleavedBufferAttribute(buffer, 4, k * 4)),
      );
    }
    const attribute = draw.geometry.getAttribute(names[0]!) as InterleavedBufferAttribute;
    return attribute.data.array as Float32Array;
  }

  /**
   * The markers' lines and dots, each kind in one draw: a line cut where it passes behind the eye
   * (to what the camera sees from `near` on), a dot as it is.
   */
  private drawInstanced(view: AidView, shared: UniformSet, lines: AidLine[], dots: AidDot[]) {
    const r = this.host.renderer;
    const cut = lines.flatMap((l) => {
      const ahead = (p: Vec3) =>
        (p[0] - view.eye[0]) * view.forward[0] +
        (p[1] - view.eye[1]) * view.forward[1] +
        (p[2] - view.eye[2]) * view.forward[2];
      const near = view.near * 1.01;
      const a = ahead(l.from);
      const b = ahead(l.to);
      if (a < near && b < near) return [];
      const at = (t: number): Vec3 => [
        l.from[0] + (l.to[0] - l.from[0]) * t,
        l.from[1] + (l.to[1] - l.from[1]) * t,
        l.from[2] + (l.to[2] - l.from[2]) * t,
      ];
      const t = (near - a) / (b - a);
      return [{ ...l, from: a < near ? at(t) : l.from, to: b < near ? at(t) : l.to }];
    });
    for (const [kind, n] of [
      ['line', cut.length],
      ['dot', dots.length],
    ] as const) {
      if (!n) continue;
      const draw = this.instancedAid(kind);
      const data = this.roomFor(kind, draw, n);
      if (kind === 'line')
        cut.forEach((l, i) =>
          data.set([...l.from, l.pixels, ...l.to, l.dashed ? 1 : 0, ...l.colour, l.alpha], i * 12),
        );
      else
        dots.forEach((d, i) =>
          data.set(
            [...d.at, d.lift, d.pixels, d.shift, d.ring, d.onTop ? 1 : 0, ...d.colour, d.alpha],
            i * 12,
          ),
        );
      (
        draw.geometry.getAttribute(
          kind === 'line' ? 'lineFrom' : 'dotAt',
        ) as InterleavedBufferAttribute
      ).data.needsUpdate = true;
      draw.geometry.instanceCount = n;
      draw.uniforms.apply(shared);
      draw.uniforms.set('uViewport', [view.width, view.height]);
      draw.uniforms.set('uFade', view.fade);
      this.scene.add(draw.mesh);
      r.render(this.scene, this.host.camera3);
      this.scene.remove(draw.mesh);
    }
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
    const lines: AidLine[] = [];
    const dots: AidDot[] = [];
    const rad = Math.PI / 180;
    for (const aid of this.shown) {
      if (aid.shape === 'line') {
        lines.push(aid);
        continue;
      }
      if (aid.shape === 'dot') {
        dots.push(aid);
        continue;
      }
      if (aid.shape === 'outline') {
        const o = aid as LightOutline;
        const { mesh, uniforms } = next('outline');
        outlines.push(mesh);
        uniforms.apply(shared);
        uniforms.set('uCentre', o.centre);
        // Its square facing the eye; the light it outlines placed as its body is lit (`o.axes`).
        uniforms.set('uAxes', bodyFrame(o.centre, o.radius, eye, view.up, placementUp(o.axes)).axes);
        uniforms.set('uLightAxes', o.axes);
        uniforms.set('uRadius', o.radius);
        uniforms.set('uExtent', o.radius * OUTLINE_EXTENT);
        uniforms.set('uKind', o.kind);
        uniforms.set('uDir', o.direction);
        uniforms.set('uPos', o.position);
        uniforms.set('uAim', o.aim);
        uniforms.set('uFade', o.fade);
        uniforms.set('uWrap', o.wrap);
        uniforms.set('uSoftness', o.softness);
        uniforms.set('uCosCone', Math.cos(o.cone * rad));
        uniforms.set('uCosFade', Math.cos(o.cone * (1 - o.edge) * rad));
        const at = outlineAt(o);
        uniforms.set('uMainAt', at.main);
        uniforms.set('uFaintAt', at.faint);
        if (o.kind === 5) {
          // The rim's turn of the view as the body's shader turns it (see `ShaderUniforms`): its
          // lean (its body's frame) put into the frame facing the eye at the body, its yaw and
          // pitch from that, turned about that frame's across and up; as a matrix's columns.
          const facing = bodyFrame(o.centre, 1, eye, view.up, placementUp(o.axes)).axes;
          const lean = rimLeanFacing(o.axes, facing, o.direction);
          const [yaw, pitch] = rimTurn(lean);
          const rows = viewTurn(facing.subarray(0, 3), facing.subarray(6, 9), -yaw, -pitch);
          uniforms.set('uRimTurn', Float32Array.from(rows));
        }
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
          const way = normalized(aid.way.map((v) => v * sign) as unknown as Vec3);
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
      const way = normalized(aid.from);
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
    // Outlines first, then the beams over them, then the markers' lines and their dots.
    this.host.renderer.setRenderTarget(null);
    for (const mesh of [...outlines, ...beams]) {
      this.scene.add(mesh);
      this.host.renderer.render(this.scene, this.host.camera3);
      this.scene.remove(mesh);
    }
    this.drawInstanced(view, shared, lines, dots);
  }

  private mesh(geometry: BufferGeometry, material: NodeMaterial): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}
