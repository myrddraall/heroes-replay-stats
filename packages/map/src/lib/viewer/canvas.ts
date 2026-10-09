import type { Viewport } from '../view/camera';

/**
 * A layer's canvas made ready for a frame: sized to the viewer in device pixels, cleared, and
 * drawn on in CSS pixels.
 */
export function frameContext(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
): CanvasRenderingContext2D {
  const width = Math.round(viewport.width * viewport.dpr);
  const height = Math.round(viewport.height * viewport.dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser has no 2D canvas');
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

/** How a layer's element sits in the viewer: over all of it, letting the pointer through. */
export const LAYER_STYLE =
  'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;';
