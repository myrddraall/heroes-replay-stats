import { InjectionToken } from '@angular/core';

/** What renderers that draw on the CPU call themselves. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Whether the browser draws WebGL on the GPU. Asked for a context that must not have a major
 * performance caveat, it refuses one where it would fall back to software rendering or the GPU is
 * blocklisted (hardware acceleration off in the browser's settings, a driver it won't use);
 * Firefox may throw instead. A context it does give is checked by its renderer's name as well.
 * Without WebGL 2 at all it is false too: there is nothing to accelerate.
 */
export function detectHardwareAcceleration(): boolean {
  const context = (options?: WebGLContextAttributes) => {
    try {
      return document.createElement('canvas').getContext('webgl2', options);
    } catch {
      return null;
    }
  };
  const release = (gl: WebGL2RenderingContext) =>
    gl.getExtension('WEBGL_lose_context')?.loseContext();

  const gl = context({ failIfMajorPerformanceCaveat: true });
  if (!gl) {
    const any = context();
    if (any) release(any);
    return false;
  }
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  release(gl);
  return !SOFTWARE_RENDERER.test(renderer);
}

/** Whether the browser draws on the GPU: detected once, when first asked. */
export const HARDWARE_ACCELERATION = new InjectionToken<boolean>('hrs.hardware-acceleration', {
  providedIn: 'root',
  factory: detectHardwareAcceleration,
});
