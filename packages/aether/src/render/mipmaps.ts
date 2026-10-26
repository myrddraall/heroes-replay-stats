import { coldShaders } from './shaders/cold-shaders';

/**
 * Images' mipmaps made ready for three.js to upload with them on WebGPU, so it makes none (it would
 * make them with a pipeline of its own, built as the first is drawn, holding the GPU up): made by a
 * pass of ours as three.js's makes them (each level drawn from the one above through a linear
 * filter, so rounded as this GPU rounds), its pipeline built in the background as the renderer
 * starts (`prepareMipmaps`), then read back.
 */

/** WebGPU's usage and map flags, by the spec's values (TypeScript's DOM types name none of them). */
const TEXTURE_COPY_SRC = 0x01;
const TEXTURE_COPY_DST = 0x02;
const TEXTURE_BINDING = 0x04;
const TEXTURE_RENDER_ATTACHMENT = 0x10;
const BUFFER_MAP_READ = 0x01;
const BUFFER_COPY_DST = 0x08;
const MAP_READ = 0x01;

/**
 * The pass's shader: a full-screen triangle, each pixel the level above read at its centre, with
 * the cold nonce where it is on (tested after the read: WGSL samples only outside branches).
 */
function source(): string {
  const n = coldShaders.nonce;
  return `
struct Out { @builtin(position) position: vec4f, @location(0) uv: vec2f };

@vertex fn vertex(@builtin(vertex_index) i: u32) -> Out {
  var corners = array(vec2f(-1, -1), vec2f(-1, 3), vec2f(3, -1));
  let p = corners[i];
  var clip = vec4f(p, 0, 1);
  ${n === null ? '' : `if (clip.x + clip.w < ${(-1e30 * n).toExponential()}) { clip = vec4f(0); }`}
  return Out(clip, p * vec2f(0.5, -0.5) + 0.5);
}

@group(0) @binding(0) var above: texture_2d<f32>;
@group(0) @binding(1) var filtered: sampler;

@fragment fn fragment(at: Out) -> @location(0) vec4f {
  let c = textureSample(above, filtered, at.uv);
  return ${n === null ? 'c' : `select(c, vec4f(0), at.position.x < ${(-n).toExponential()})`};
}`;
}

interface Pass {
  readonly pipeline: GPURenderPipeline;
  readonly sampler: GPUSampler;
}

const passes = new WeakMap<GPUDevice, Promise<Pass>>();

function passOf(device: GPUDevice): Promise<Pass> {
  let pass = passes.get(device);
  if (!pass) {
    const module = device.createShaderModule({ label: 'mipmaps', code: source() });
    pass = device
      .createRenderPipelineAsync({
        label: 'mipmaps',
        layout: 'auto',
        vertex: { module, entryPoint: 'vertex' },
        fragment: { module, entryPoint: 'fragment', targets: [{ format: 'rgba8unorm' }] },
        primitive: { topology: 'triangle-list' },
      })
      .then((pipeline) => ({
        pipeline,
        sampler: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }),
      }));
    passes.set(device, pass);
  }
  return pass;
}

/** The pass's pipeline built now, in the background (the renderer's first images need it as it starts). */
export function prepareMipmaps(device: GPUDevice): void {
  void passOf(device);
}

/** An image's mipmaps, the image first, each level half the last, down to a pixel. */
export async function mipChain(device: GPUDevice, image: ImageBitmap): Promise<ImageBitmap[]> {
  const { width, height } = image;
  const count = Math.floor(Math.log2(Math.max(width, height))) + 1;
  if (count === 1) return [image];
  const texture = device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    mipLevelCount: count,
    usage: TEXTURE_COPY_SRC | TEXTURE_COPY_DST | TEXTURE_BINDING | TEXTURE_RENDER_ATTACHMENT,
  });
  try {
    // (As three.js uploads it.)
    device.queue.copyExternalImageToTexture(
      { source: image, flipY: false },
      { texture, premultipliedAlpha: false },
      [width, height],
    );
    const { pipeline, sampler } = await passOf(device);
    // Each level below the image, its rows 256 bytes apart at the least, one after another in one buffer.
    const levels: {
      level: number;
      width: number;
      height: number;
      offset: number;
      stride: number;
    }[] = [];
    let size = 0;
    for (let level = 1; level < count; level++) {
      const w = Math.max(1, width >> level);
      const h = Math.max(1, height >> level);
      const stride = Math.ceil((w * 4) / 256) * 256;
      levels.push({ level, width: w, height: h, offset: size, stride });
      size += stride * h;
    }
    const buffer = device.createBuffer({ size, usage: BUFFER_COPY_DST | BUFFER_MAP_READ });
    try {
      const encoder = device.createCommandEncoder({ label: 'mipmaps' });
      for (const { level, width: w, height: h, offset, stride } of levels) {
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }),
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(
          0,
          device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              {
                binding: 0,
                resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }),
              },
              { binding: 1, resource: sampler },
            ],
          }),
        );
        pass.draw(3);
        pass.end();
        encoder.copyTextureToBuffer(
          { texture, mipLevel: level },
          { buffer, offset, bytesPerRow: stride },
          [w, h],
        );
      }
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(MAP_READ);
      const read = new Uint8Array(buffer.getMappedRange());
      const data = levels.map(({ width: w, height: h, offset, stride }) => {
        const row = w * 4;
        const pixels = new Uint8ClampedArray(row * h);
        for (let y = 0; y < h; y++)
          pixels.set(read.subarray(offset + y * stride, offset + y * stride + row), y * row);
        return new ImageData(pixels, w, h);
      });
      buffer.unmap();
      const bitmaps = await Promise.all(
        data.map((d) =>
          createImageBitmap(d, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
        ),
      );
      return [image, ...bitmaps];
    } finally {
      buffer.destroy();
    }
  } finally {
    texture.destroy();
  }
}
