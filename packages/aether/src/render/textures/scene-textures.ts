import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  Texture,
} from 'three/webgpu';
import type { DrawState } from '../draw-types';
import { layersOf } from '../uniforms/draw-uniforms';
import { mipChain } from './mipmaps';
import { type Slot, SLOTS } from '../materials/material-shader';

/**
 * The scene's images as its draws sample them: each image (by key) a texture for each way it
 * repeats, with its mipmaps; a white placeholder where a layer has none, each shader slot its own.
 */
export class SceneTextures {
  private readonly images = new Map<string, ImageBitmap>();
  /**
   * Each image's mipmaps on WebGPU (`mipChain`), by its key, made as a draw first needs it (null
   * meanwhile; false where they couldn't be made: three.js makes them). WebGL's are its driver's
   * (generateMipmap, which needs no pipeline of three.js's).
   */
  private readonly mips = new Map<string, ImageBitmap[] | null | false>();
  /** The textures as the layers sample them, by image and how they repeat (one image, several ways). */
  private readonly sampled = new Map<string, Texture>();
  private readonly placeholder: Texture;
  /** Each slot's own placeholder (the same white): two slots never share one, which would change the shader. */
  readonly slotPlaceholders: Record<Slot, Texture>;

  constructor(
    images: Readonly<Record<string, ImageBitmap>>,
    /** The WebGPU device the mipmaps are made on; none: the backend's driver makes them (WebGL). */
    private readonly device: () => GPUDevice | null,
    /** An image's mipmaps are made, or couldn't be: what waited on them can draw. */
    private readonly changed: () => void,
    /** Why an image's mipmaps couldn't be made. */
    private readonly failed: (why: string) => void,
  ) {
    for (const [key, image] of Object.entries(images)) this.images.set(key, image);
    const white = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    // Filtered: three.js's WebGPU backend leaves a nearest-filtered texture without the sampler
    // that sampling it with gradients names.
    white.minFilter = LinearFilter;
    white.magFilter = LinearFilter;
    white.needsUpdate = true;
    this.placeholder = white;
    this.slotPlaceholders = Object.fromEntries(
      SLOTS.map((slot) => {
        const t = white.clone();
        t.needsUpdate = true;
        return [slot, t];
      }),
    ) as unknown as Record<Slot, Texture>;
  }

  /** How many images there are. */
  get size(): number {
    return this.images.size;
  }

  has(key: string): boolean {
    return this.images.has(key);
  }

  /** An image under its key, unless one is there already. */
  add(key: string, image: ImageBitmap): void {
    if (!this.images.has(key)) this.images.set(key, image);
  }

  private mipsOf(key: string, image: ImageBitmap, device: GPUDevice): ImageBitmap[] | null | false {
    const made = this.mips.get(key);
    if (made !== undefined) return made;
    this.mips.set(key, null);
    mipChain(device, image).then(
      (chain) => {
        this.mips.set(key, chain);
        this.changed();
      },
      (error: unknown) => {
        // (Its draws not held up: three.js makes its mipmaps, as it would have; the check reports it.)
        this.mips.set(key, false);
        this.changed();
        this.failed(
          `an image's mipmaps weren't made: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn('a background image has no ready-made mipmaps:', error);
      },
    );
    return null;
  }

  /**
   * A texture as a layer samples it: its image, repeating or not each way, with its mipmaps; null
   * while they are being made.
   */
  sampledTexture(
    key: string | undefined,
    wrap: readonly [boolean, boolean] | undefined,
  ): Texture | null {
    const image = key ? this.images.get(key) : undefined;
    if (!key || !image) return this.placeholder;
    const device = this.device();
    const mipmaps = device ? this.mipsOf(key, image, device) : undefined;
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
  of(s: DrawState): Record<Slot, Texture> | null {
    const layers = layersOf(s.material);
    const textures = SLOTS.map((_, i) => this.sampledTexture(layers[i]?.texture, layers[i]?.wrap));
    if (textures.includes(null)) return null;
    return Object.fromEntries(
      SLOTS.map((slot, i) => [
        slot,
        textures[i] === this.placeholder ? this.slotPlaceholders[slot] : textures[i]!,
      ]),
    ) as Record<Slot, Texture>;
  }

  dispose(): void {
    for (const t of this.sampled.values()) t.dispose();
  }
}
