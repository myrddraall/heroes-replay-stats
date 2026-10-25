import type { Node, NodeMaterial } from 'three/webgpu';
import { float, Fn, modelViewProjection, screenCoordinate, select, vec4 } from 'three/tsl';

/**
 * Cold compiles, for measuring them (the renderer check): a number unique to the run (the check
 * sets one for each test), put into every shader stage so no shader cache (the browser's, Dawn's
 * per stage, the driver's) has it from before. It is tested against a value known only as the
 * shader runs (the pixel's position, the clip position's w), never against a constant, so no
 * compiler can fold it away: an output is replaced by nothing only past minus the number, which no
 * pixel or vertex is. Off (null) unless a page turns it on before the renderer's shaders are built.
 */
export const coldShaders: { nonce: number | null } = { nonce: null };

/** A fragment shader's output with the nonce in it, where cold compiles are on. */
export function cold(colour: Node<'vec4'>): Node<'vec4'> {
  const n = coldShaders.nonce;
  return n === null ? colour : select(screenCoordinate.x.lessThan(-n), vec4(0), colour);
}

/**
 * A depth written given the nonce, where cold compiles are on: for a pass that writes no colour
 * (its colour's nonce would be folded away with the colour it never writes).
 */
export function coldDepth(d: Node<'float'>): Node<'float'> {
  const n = coldShaders.nonce;
  return n === null ? d : select(screenCoordinate.x.lessThan(-n), float(0), d);
}

/**
 * A material's vertex stage given the nonce, where cold compiles are on: its own clip position, or
 * three.js's. Its x plus its w (x a value only known as it runs, even where w is a constant) is
 * tested against minus 10^30 times the number, which no vertex reaches (one behind the eye has a
 * negative w, but nowhere near that).
 */
export function coldVertex(material: NodeMaterial): void {
  const n = coldShaders.nonce;
  if (n === null) return;
  const clip = (material.vertexNode as Node<'vec4'> | null) ?? (modelViewProjection as unknown as Node<'vec4'>);
  material.vertexNode = Fn(() => {
    const c = vec4(clip).toVar();
    return select(c.x.add(c.w).lessThan(-1e30 * n), vec4(0), c);
  })();
}
