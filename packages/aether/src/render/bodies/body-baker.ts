import type { PerspectiveCamera, WebGPURenderer } from 'three/webgpu';
import { layerOffset, type SceneCamera } from '../../formats/play-scene';
import { MAX_SURFACES } from '../uniforms/limits';
import { UniformSet } from '../uniforms/uniforms';
import {
  bakeRect,
  bakeSize,
  frameSpot,
  type PixelRect,
  REBAKE_PIXELS,
  scrollPixels,
} from './body-bakes';
import { multiplyMatrices as multiply, partsExtent, ringScale } from '../../space/space';
import {
  DEFAULT_ORIENTATION,
  type DrawFrames,
  drawFrames,
  IDENTITY,
  isIdentity,
  type Orientation,
} from '../../space/graph';
import { setBodyFrames } from './body-frames';
import { type Bake, type GpuDraw, OUTPUTS, type Output, type Placed } from '../draw-types';
import type { GpuDraws } from '../gpu-draws';
import type { PassChain } from '../passes/pass-chain';
import { type Vec3, distance } from '../../space/vectors';

/** What the bakes need of the renderer. */
export interface BodyBakerHost {
  readonly renderer: WebGPURenderer;
  readonly camera3: PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly gpu: GpuDraws;
  readonly chain: PassChain;
  /** The camera the picture is drawn through, and its view matrix. */
  camera(): SceneCamera;
  view(): Float32Array;
  /** What a bake is made again for when it changes: the view, the still sky, the bodies' surfaces. */
  viewVersion(): number;
  skyVersion(): number;
  surfacesKey(): string;
  /** The bodies' surfaces a body's light can be shaded by (each its centre and radius). */
  surfaces(): number[][];
  /** The scene's bloom threshold (what of a draw blooms). */
  sceneThreshold(): number;
  /** The bodies placed. */
  placed(): readonly Placed[];
  /** How bright the bodies marked dimmed are put into the frame (see `Renderer.dim`). */
  dim(): number;
}

/** How much bigger than its rectangle a bake is made (see `sizeBake`). */
const BAKE_ROOM = 1.25;

/**
 * The bodies baked: each drawn on its own into a pass of its own, only when it changes (the view,
 * the sky, its settings, its scrolling layers far enough), and put back into each frame as an
 * impostor, far to near.
 */
export class BodyBaker {
  /** How many bakes were made again at another size since last asked (see `takeResizes`). */
  private resizes = 0;
  constructor(private readonly host: BodyBakerHost) {}
  /** How many bakes were made again at another size since last asked (the frame stats). */
  takeResizes(): number {
    const n = this.resizes;
    this.resizes = 0;
    return n;
  }

  private bakeKey(body: Placed): string {
    return `${this.host.viewVersion()}:${this.host.skyVersion()}:${body.version}:${body.hasShapes ? this.host.surfacesKey() : ''}`;
  }
  bakeDue(body: Placed, seconds: number): boolean {
    if (body.body.hidden) return false;
    const b = body.bake;
    if (!b || !b.complete || b.key !== this.bakeKey(body)) return true;
    return b.scroll > 0 && Math.abs(seconds - b.at) * b.scroll >= REBAKE_PIXELS;
  }
  private newBake(): Bake {
    return {
      pass: null,
      width: 0,
      height: 0,
      rect: null,
      key: '',
      at: 0,
      complete: false,
      scroll: 0,
      shift: 0,
    };
  }
  /**
   * A bake big enough for its rectangle: as it is, where it fits and isn't twice as big as needed;
   * else made again, a quarter bigger than needed (a body growing in the view, as it is zoomed to,
   * isn't made again at every step), no bigger than the frame, its old pass a spare for another.
   */
  private sizeBake(bake: Bake, rect: PixelRect): void {
    const fits = rect.w <= bake.width && rect.h <= bake.height;
    const roomy = bake.width > 2 * bakeSize(rect.w) || bake.height > 2 * bakeSize(rect.h);
    if (fits && !roomy && bake.pass) return;
    const { width, height } = this.host.canvas;
    bake.width = bakeSize(Math.min(rect.w * BAKE_ROOM, width + 1));
    bake.height = bakeSize(Math.min(rect.h * BAKE_ROOM, height + 1));
    this.resizes++;
    this.host.chain.giveBakePass(bake.pass);
    bake.pass = this.host.chain.takeBakePass(bake.width, bake.height);
  }
  freeBake(bake: Bake | null): void {
    if (!bake) return;
    this.host.chain.giveBakePass(bake.pass);
    bake.pass = null;
  }
  /**
   * A body drawn on its own into its bake: the frame's pixels it covers, each as the frame has it,
   * its draws in its drawing order, at `seconds`. Its view is drawn through a projection that puts
   * the rectangle it covers onto its bake (not an offset viewport: WebGPU allows none past a
   * target's edge).
   */
  bakeBody(body: Placed, seconds: number, viewProjection: Float32Array): void {
    // Baked only whole: until every draw of it is ready (built now where missing), its last whole
    // bake stays up (a new body shows once whole); `bakeDue` asks again each frame meanwhile.
    // (Every part asked for, not only up to the first that isn't ready: each one's mipmaps and
    // compile start together, not one after another.)
    let whole = true;
    for (const s of body.states)
      if (s.enabled && s.part && !this.host.gpu.gpuOf(s)?.ready) whole = false;
    if (!whole) return;
    const { width, height } = this.host.canvas;
    const { position } = body.body;
    // (Its square faces the eye, whichever way its surfaces are turned.)
    const { axes } = body.quad;
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
      width / bw,
      0,
      0,
      0,
      0,
      height / bh,
      0,
      0,
      0,
      0,
      1,
      0,
      (width - 2 * rect.x) / bw - 1,
      1 + (2 * top - height) / bh,
      0,
      1,
    ]);
    const bakeViewProjection = multiply(onBake, viewProjection);
    const v = this.host.view();
    const eyeDistance = Math.hypot(...body.quad.eye);
    const radius = body.body.radius;
    // Each draw's frames, by which way it is turned and whether its body's own turn turns it (a
    // few at most for a body: see `drawFrames`).
    const bodyTurned = body.body.turn;
    const frames = new Map<string, DrawFrames>();
    const framesOf = (orientation: Orientation, turned: boolean) => {
      const key = `${orientation}:${turned}`;
      let f = frames.get(key);
      if (!f)
        frames.set(
          key,
          (f = drawFrames({
            placement: body.placementFrame,
            quad: body.quad,
            centre: position,
            radius,
            eye: this.host.camera().eye,
            viewRight: [v[0]!, v[4]!, v[8]!],
            viewUp: [v[1]!, v[5]!, v[9]!],
            orientation,
            turn: turned ? bodyTurned : IDENTITY,
          })),
        );
      return f;
    };
    const pixel =
      (2 * eyeDistance * radius * Math.tan((this.host.camera().fovY * Math.PI) / 360)) / height;
    const spot = frameSpot(position, radius, [v[0]!, v[4]!, v[8]!], viewProjection, width, height);
    // (The sky light is read from the top left: its spot's height and up turned over.)
    const skyAt = [spot[0], 1 - spot[1], spot[2], -spot[3]];
    const surfaces = new UniformSet();
    surfaces.i1('uSurfaceCount', this.host.surfaces().length);
    surfaces.fv(
      'uSurfaces',
      [
        ...this.host.surfaces().flat(),
        ...Array<number>((MAX_SURFACES - this.host.surfaces().length) * 4).fill(0),
      ],
      '4fv',
    );
    const scene = this.host.gpu.bodyScene(body);
    for (const c of scene.children) c.visible = false;
    let complete = true;
    const drawn: { gpu: GpuDraw; order: number }[] = [];
    body.states.forEach((s, order) => {
      if (!s.enabled || !s.part) return;
      const gpu = this.host.gpu.gpuOf(s);
      if (!gpu?.ready) {
        complete = false;
        return;
      }
      const u = gpu.uniforms;
      u.set('uViewProjection', bakeViewProjection);
      u.set('uSmear', 0);
      u.set('uSceneThreshold', this.host.sceneThreshold());
      u.set('uCentre', position);
      u.set('uRadius', radius);
      const orientation = s.orientation ?? DEFAULT_ORIENTATION;
      setBodyFrames(u, framesOf(orientation, !!s.turned), s.leans ?? {});
      u.set('uSkyAt', skyAt);
      u.apply(surfaces);
      for (const { slot, layer } of s.scrolls)
        u.set(`uLayers[${slot}].offset`, layerOffset(layer, seconds));
      const standing =
        orientation === 'world' || (s.turned && !isIdentity(bodyTurned))
          ? new Set([s.part])
          : undefined;
      const reachOf = partsExtent(radius, [s.part], eyeDistance * radius, standing) + 2 * pixel;
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
      this.host.chain.clear(this.host.chain.target(bake.pass!, output), 0);
      if (drawn.length) this.host.renderer.render(scene, this.host.camera3);
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
  compositeBodies(viewProjection: Float32Array, output: Output): void {
    const { width, height } = this.host.canvas;
    const eye = this.host.camera().eye;
    const shownBodies = this.host
      .placed()
      .filter((b) => !b.body.hidden && b.bake?.complete && b.bake.rect && b.bake.pass)
      .sort((a, b) => distance(b.body.position, eye) - distance(a.body.position, eye));
    for (const body of shownBodies) {
      const bake = body.bake!;
      const r = bake.rect!;
      const top = height - (r.y + r.h);
      // Each in turn: its depths, then its colour (the next body's over it).
      for (const impostor of this.host.chain.impostorsOf(bake.pass!)[output]) {
        const u = impostor.uniforms;
        // Its rectangle in the frame's normalized device coordinates (y up), its corner from the top left.
        u.set('uRect', [
          (2 * r.x) / width - 1,
          1 - (2 * (top + r.h)) / height,
          (2 * (r.x + r.w)) / width - 1,
          1 - (2 * top) / height,
        ]);
        u.set('uOrigin', [r.x, top - bake.shift]);
        u.set('uFront', this.frontDepth(body, viewProjection));
        u.set('uDim', body.body.dimmed ? this.host.dim() : 1);
        this.host.renderer.render(impostor.scene, this.host.camera3);
      }
    }
  }
  private frontDepth(body: Placed, viewProjection: Float32Array): number {
    const { position } = body.body;
    const eye = this.host.camera().eye;
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
}
