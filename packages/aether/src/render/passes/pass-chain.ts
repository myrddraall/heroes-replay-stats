import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  type NodeMaterial,
  type PlaneGeometry,
  RenderTarget,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector2,
  type WebGPURenderer,
} from 'three/webgpu';
import { uniform } from 'three/tsl';
import { type ImpostorDraw, OUTPUTS, type Output, type Pass } from '../draw-types';
import { floatTarget, freeGpu } from '../gpu';
import {
  bloomBlurMaterial,
  bloomPrepassMaterial,
  compositeMaterial,
  copyDepthMaterial,
  copyMaterial,
  downsampleMaterial,
  impostorMaterial,
  PassQuad,
  type ToClip,
  toneMaterial,
} from './pass-shaders';
import { DrawValues, ShaderUniforms, withValues } from '../uniforms/shader-uniforms';
import { BLOOM_PASSES, BLOOM_SCALE, BLOOM_SPACING, SKY_LIGHT_SIZE } from '../tuning';

/** What the pass chain needs of the renderer it serves. */
export interface PassChainHost {
  readonly renderer: WebGPURenderer;
  readonly canvas: HTMLCanvasElement;
  /** The camera-facing square the impostors are drawn on. */
  readonly square: PlaneGeometry;
  /** Clip space into the API's (as the backend has it once started). */
  toClip(): ToClip;
  backendName(): string | null;
  /** An object's program compiled for the target it draws into (as it draws there). */
  compile(object: Mesh, target: RenderTarget | null, scene?: Scene | null): Promise<void>;
  /** Every draw the first picture has, made (their programs compiling with the passes'). */
  makeDraws(): void;
  /** The passes can draw now: draw again. */
  changed(): void;
  /** A pass's program failed to compile: nothing can be drawn. */
  failed(error: unknown): void;
}

/** How many bakes' passes are kept spare at most (see `PassChain.spareBakes`). */
const MAX_SPARE_BAKES = 6;

/**
 * The targets a picture is drawn through and the passes between them: the frame (colour and glow,
 * each with its depth), the still sky's (what doesn't move, drawn again only when it changes), the
 * small sky light the bodies are lit by, the bloom, the tone onto the canvas, and the bakes'
 * impostors. Sized to the canvas.
 */
export class PassChain {
  /**
   * Each bake's impostors (its colour's and its glow's, passes 0 and 1), its own objects, the
   * impostors' two materials shared: a texture swapped into an object after its first draw may
   * stay unbound on WebGPU, which keeps an object's bindings.
   */
  readonly bakeImpostors = new Map<Pass, Record<Output, ImpostorDraw[]>>();
  stillBackground: Pass | null = null;
  stillScene: Pass | null = null;
  frame: Pass | null = null;
  /**
   * What doesn't move of the sky, small (SKY_LIGHT_SIZE square, blurred as read), for the
   * environment lights: drawn again with the still sky; bodies are baked again when it is
   * (`skyVersion`).
   */
  readonly skyLight: RenderTarget;
  /** It at half its size and at a quarter: its mipmaps one and two, made by passes of their own. */
  readonly skyLightHalf: RenderTarget;
  readonly skyLightQuarter: RenderTarget;
  bloom: [RenderTarget, RenderTarget] | null = null;
  passes: {
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
  readonly bloomStep = uniform(new Vector2());
  readonly blurSteps = [uniform(new Vector2()), uniform(new Vector2())] as const;
  readonly bloomThreshold = uniform(0.6);
  /** Whether the passes' programs have compiled (nothing is drawn until they have). */
  passesReady = false;
  /** The tone-mapped picture's target, made to be read back (`readPixels`). */
  private shownTarget: RenderTarget | null = null;

  /**
   * Bakes' passes let go of (a bake made again at another size, a body taken down), with their
   * impostors, kept to be taken again by a bake of their size: a bake made again costs no
   * allocation. A few at most, as many pixels as two frames at most, the oldest let go of first.
   */
  private readonly spareBakes: Pass[] = [];
  /** A pass for a bake `width` × `height`: a spare one of that size, else a new one. */
  takeBakePass(width: number, height: number): Pass {
    const i = this.spareBakes.findIndex(
      (p) => p.colour.width === width && p.colour.height === height,
    );
    return i >= 0 ? this.spareBakes.splice(i, 1)[0]! : this.newPass(width, height);
  }
  /** A bake's pass let go of: kept as a spare (see `spareBakes`). */
  giveBakePass(pass: Pass | null): void {
    if (!pass) return;
    this.spareBakes.push(pass);
    const { width, height } = this.host.canvas;
    const pixels = () => this.spareBakes.reduce((n, p) => n + p.colour.width * p.colour.height, 0);
    while (
      this.spareBakes.length > MAX_SPARE_BAKES ||
      (this.spareBakes.length && pixels() > 2 * width * height)
    )
      this.freePass(this.spareBakes.shift()!);
  }
  newPass(width: number, height: number): Pass {
    return { colour: floatTarget(width, height), glow: floatTarget(width, height) };
  }
  freePass(pass: Pass | null): void {
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
   * ones would not have their programs on the frame drawn straight after a resize). Their depth
   * textures go with them (three.js sizes a target's own depth texture again as it is drawn to):
   * marked changed by hand, a depth texture is made again at the same size while three.js's
   * render pass for the target, kept by its size, still draws into the one destroyed.
   */
  allocateAll(): void {
    const { width, height } = this.host.canvas;
    const bw = Math.max(1, Math.ceil(width / BLOOM_SCALE));
    const bh = Math.max(1, Math.ceil(height / BLOOM_SCALE));
    if (this.passes && this.stillBackground && this.stillScene && this.frame && this.bloom) {
      for (const pass of [this.stillBackground, this.stillScene, this.frame])
        for (const t of [pass.colour, pass.glow]) t.setSize(width, height);
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
        ...OUTPUTS.map(
          (o) => [`scene:${o}`, quad(compositeMaterial(of(still.scene, o).texture, true))] as const,
        ),
        ['skyBackground', quad(compositeMaterial(still.background.colour.texture, false))],
        ['skyScene', quad(compositeMaterial(still.scene.colour.texture, false))],
      ]),
      bloomPrepass: quad(
        bloomPrepassMaterial(
          frame.colour.texture,
          frame.glow.texture,
          this.bloomStep,
          this.bloomThreshold,
        ),
      ),
      blur: [
        quad(bloomBlurMaterial(this.bloom[0].texture, this.blurSteps[0])),
        quad(bloomBlurMaterial(this.bloom[1].texture, this.blurSteps[1])),
      ],
      tone: quad(toneMaterial(toneUniforms, frame.colour.texture, this.bloom[0].texture)),
      toneUniforms,
      downsample: [
        quad(downsampleMaterial(this.skyLight.texture)),
        quad(downsampleMaterial(this.skyLightHalf.texture)),
      ],
      impostors: [],
      placeholder: this.newPass(1, 1),
    };
    const placeholder = this.passes.placeholder.colour;
    this.passes.impostors = ([0, 1] as const).map((pass) => {
      const material = impostorMaterial(
        new ShaderUniforms(true),
        placeholder.texture,
        placeholder.depthTexture!,
        pass,
        this.host.toClip(),
      );
      material.userData['shared'] = true;
      const mesh = withValues(new Mesh(this.host.square, material), new DrawValues());
      mesh.frustumCulled = false;
      const scene = new Scene();
      scene.add(mesh);
      return { material, mesh, scene };
    });
    this.bloomStep.value.set(1 / width, 1 / height);
    this.compilePasses();
  }
  /**
   * The passes' programs compiled in the background, each for the target it draws into (as it
   * draws there: see `compileFor`), and with them every draw the first picture has (`makeDraws`):
   * all side by side.
   */
  compilePasses(): void {
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
    const compiled = into.map(([quad, target]) => this.host.compile(quad, target));
    for (const { mesh, scene } of p.impostors)
      for (const o of OUTPUTS) compiled.push(this.host.compile(mesh, this.target(frame, o), scene));
    void Promise.all(compiled).then(
      () => {
        this.passesReady = true;
        this.host.changed();
      },
      (error: unknown) => {
        this.host.failed(error);
      },
    );
    this.host.makeDraws();
  }
  target(pass: Pass, output: Output): RenderTarget {
    return output === 'glow' ? pass.glow : pass.colour;
  }
  /** A target cleared to black, covering as far as `alpha` says, its depth to the farthest. */
  clear(target: RenderTarget, alpha: number): void {
    this.host.renderer.setRenderTarget(target);
    this.host.renderer.setClearColor(0x000000, alpha);
    this.host.renderer.clear(true, true, false);
  }
  /** A bake's impostors (made the first time it is put into the frame; let go of with its pass). */
  impostorsOf(pass: Pass): Record<Output, ImpostorDraw[]> {
    let made = this.bakeImpostors.get(pass);
    if (!made) {
      const of = (output: Output) => {
        const target = this.target(pass, output);
        return ([0, 1] as const).map((n) => {
          const uniforms = new DrawValues({ colour: target.texture, depth: target.depthTexture! });
          const mesh = withValues(
            new Mesh(this.host.square, this.passes!.impostors[n]!.material),
            uniforms,
          );
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
  drawBloom(threshold: number): void {
    const r = this.host.renderer;
    const bloom = this.bloom!;
    this.bloomThreshold.value = threshold;
    r.setRenderTarget(bloom[0]);
    this.passes!.bloomPrepass.render(r);
    const [w, h] = [bloom[0].width, bloom[0].height];
    for (let i = 0; i < BLOOM_PASSES * 2; i++) {
      const from = i % 2;
      this.blurSteps[from].value.set(
        i % 2 === 0 ? BLOOM_SPACING / w : 0,
        i % 2 === 0 ? 0 : BLOOM_SPACING / h,
      );
      r.setRenderTarget(bloom[(i + 1) % 2]);
      this.passes!.blur[from].render(r);
    }
  }
  /**
   * The last frame's picture as shown (tone-mapped; no beams), top row first, RGBA: for the
   * renderer check, which compares the picture drawn on WebGPU with the one drawn on WebGL 2.
   */
  async readPixels(): Promise<Uint8Array> {
    const { width, height } = this.host.canvas;
    if (!this.passes) return new Uint8Array(width * height * 4);
    if (
      !this.shownTarget ||
      this.shownTarget.width !== width ||
      this.shownTarget.height !== height
    ) {
      this.shownTarget?.dispose();
      this.shownTarget = new RenderTarget(width, height, {
        type: UnsignedByteType,
        format: RGBAFormat,
        generateMipmaps: false,
        depthBuffer: false,
      });
    }
    this.host.renderer.setRenderTarget(this.shownTarget);
    this.passes.tone.render(this.host.renderer);
    this.host.renderer.setRenderTarget(null);
    const data = new Uint8Array(
      (
        (await this.host.renderer.readRenderTargetPixelsAsync(
          this.shownTarget,
          0,
          0,
          width,
          height,
        )) as Uint8Array
      ).buffer,
    );
    const row = width * 4;
    const out = new Uint8Array(row * height);
    if (this.host.backendName() === 'WebGPU') {
      // WebGPU's rows are padded to 256 bytes each, top row first.
      const stride = Math.ceil(row / 256) * 256;
      for (let y = 0; y < height; y++)
        out.set(data.subarray(y * stride, y * stride + row), y * row);
    } else {
      // WebGL's bottom row first.
      for (let y = 0; y < height; y++)
        out.set(data.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    return out;
  }

  constructor(private readonly host: PassChainHost) {
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
  }

  /** Free what the GPU holds of the targets, the spare bakes' too (a bake's own is let go of with its bake). */
  dispose(): void {
    for (const p of [this.stillBackground, this.stillScene, this.frame]) this.freePass(p);
    for (const p of this.spareBakes.splice(0)) this.freePass(p);
    for (const t of this.bloom ?? []) t.dispose();
    this.skyLight.dispose();
  }
}
