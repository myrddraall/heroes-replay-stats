import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectHardwareAcceleration } from './hardware-acceleration';

/** WebGL 2 as a browser gives it: a context unless it would have a major performance caveat. */
function browser({
  caveat,
  renderer = 'ANGLE (NVIDIA GeForce RTX 4080)',
}: {
  caveat: boolean;
  renderer?: string;
}) {
  const gl = {
    RENDERER: 0x1f01,
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: () => undefined } : null,
    getParameter: () => renderer,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    _: string,
    options?: WebGLContextAttributes,
  ) => (caveat && options?.failIfMajorPerformanceCaveat ? null : gl)) as never);
}

describe('detectHardwareAcceleration', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is on where the browser gives a context without a performance caveat', () => {
    browser({ caveat: false });
    expect(detectHardwareAcceleration()).toBe(true);
  });

  it('is off where it would only give one with a caveat (software, or a blocklisted GPU)', () => {
    browser({ caveat: true });
    expect(detectHardwareAcceleration()).toBe(false);
  });

  it('is off where the renderer is a software one all the same', () => {
    browser({ caveat: false, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))' });
    expect(detectHardwareAcceleration()).toBe(false);
  });

  it('is off without WebGL 2, or where asking throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('no');
    });
    expect(detectHardwareAcceleration()).toBe(false);
  });
});
