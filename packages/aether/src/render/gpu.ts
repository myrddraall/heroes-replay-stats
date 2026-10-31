import {
  BufferAttribute,
  BufferGeometry,
  DepthTexture,
  FloatType,
  HalfFloatType,
  Mesh,
  NearestFilter,
  NoColorSpace,
  NodeMaterial,
  RenderTarget,
  RGBAFormat,
} from 'three/webgpu';
import { type SceneMesh } from '../formats/play-scene';
import { DrawValues } from './uniforms/shader-uniforms';

/** Render targets and GPU work the renderer waits for or frees. */

/** A float target the canvas's size (or another), with its depth as a texture. */
export function floatTarget(width: number, height: number, depth = true): RenderTarget {
  const target = new RenderTarget(width, height, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
    depthBuffer: depth,
  });
  target.texture.colorSpace = NoColorSpace;
  if (depth) {
    target.depthTexture = new DepthTexture(width, height);
    target.depthTexture.type = FloatType;
  }
  return target;
}

/** Resolves once a WebGL context's GPU has done all the work sent to it so far (polled, not waited on); rejects if the context is lost. */
export function fenced(gl: WebGL2RenderingContext): Promise<void> {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (gl.isContextLost()) reject(new Error('the context was lost'));
      else if (!sync || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) {
        if (sync) gl.deleteSync(sync);
        resolve();
      } else setTimeout(poll, 4);
    };
    poll();
  });
}

/**
 * A draw's GPU side let go of: three.js's state for its mesh (its bindings; the programs and
 * pipelines it holds), its table, and its material unless the material is shared.
 */
export function freeGpu(gpu: { readonly mesh: Mesh; readonly uniforms: DrawValues }): void {
  const material = gpu.mesh.material as NodeMaterial;
  (gpu.mesh as unknown as { dispatchEvent(event: { type: 'dispose' }): void }).dispatchEvent({
    type: 'dispose',
  });
  if (!material.userData['shared']) material.dispose();
  gpu.uniforms.texture?.dispose();
}

/** A sky mesh's geometry: its points, both uv sets, normals and colours, and its triangles. */
export function meshGeometry(mesh: SceneMesh): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(mesh.uvs), 2));
  g.setAttribute('uv1', new BufferAttribute(new Float32Array(mesh.uvs2 ?? mesh.uvs), 2));
  g.setAttribute(
    'normal',
    new BufferAttribute(
      mesh.normals ? new Float32Array(mesh.normals) : new Float32Array(mesh.positions.length),
      3,
    ),
  );
  g.setAttribute('color', new BufferAttribute(new Uint8Array(mesh.colors), 4, true));
  g.setIndex(new BufferAttribute(new Uint16Array(mesh.indices), 1));
  return g;
}
