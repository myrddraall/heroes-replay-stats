import type { MaterialDepth, MaterialSettings } from '../materials/material-settings';
import { eyeOf, multiplyMatrices, rigidInverse } from '../space/space';

/**
 * How the sky is anchored against the camera (`SkyAnchor`), as the renderer and the Background
 * page's panels read it: each of its materials' anchor from the levels that set it, where it is
 * drawn among the scene's objects once anchored, and where it is in the world for a camera.
 *
 * Two cameras say where an anchored sky is. The reference camera is the scene's own (the scene
 * file's: the one its layout is fitted to and its moons placed from): the sky is where it is in the
 * world for it, whatever its anchor. The followed camera is the one the sky moves with: normally
 * the camera that draws, so a backdrop stays a backdrop; in the editor, with the sky not following
 * the view, the scene's camera being authored, so the sky can be seen from outside, where it is for
 * that camera.
 */

/** The anchors a sky or one of its materials may be given. */
export const SKY_ANCHORS: readonly SkyAnchor[] = ['world', 'position', 'camera'];

/** The anchor where nothing sets one: fixed in the world, as the game draws its sky. */
export const DEFAULT_SKY_ANCHOR: SkyAnchor = 'world';

/** A sky material's anchor: its own where set (its settings merged through its levels), else the sky's, else the world. */
export const skyAnchorOf = (
  settings: MaterialSettings | undefined,
  sky: SkyAnchor | undefined,
): SkyAnchor => settings?.anchor ?? sky ?? DEFAULT_SKY_ANCHOR;

/**
 * Where a sky material is drawn among the scene's objects, anchored: one not fixed in the world is
 * seen from elsewhere than the planets are, so it has no depth among them: it is drawn behind them
 * all (`background`) unless it is drawn in front of them all (`foreground`).
 */
export const anchoredDepth = (depth: MaterialDepth, anchor: SkyAnchor): MaterialDepth =>
  anchor !== 'world' && depth === 'scene' ? 'background' : depth;

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * Where an anchored sky is put in the world (column-major), from the followed camera's view and the
 * reference camera's: fixed (`world`: as it is); moved by as far as the followed eye is from the
 * reference one (`position`); moved and turned so the followed camera sees it as the reference
 * camera does (`camera`: the followed view undone, then the reference view).
 */
export function skyTransform(
  anchor: SkyAnchor,
  follow: Float32Array,
  reference: Float32Array,
): Float32Array {
  if (anchor === 'camera') return multiplyMatrices(rigidInverse(follow), reference);
  if (anchor === 'world') return IDENTITY;
  const f = eyeOf(follow);
  const l = eyeOf(reference);
  const out = new Float32Array(IDENTITY);
  out[12] = f[0] - l[0];
  out[13] = f[1] - l[1];
  out[14] = f[2] - l[2];
  return out;
}

/**
 * The view an anchored sky is drawn through by the camera that draws (`view`): its view after the
 * sky is put where its anchor says (see `skyTransform`). Following the camera that draws, a sky
 * anchored to the camera is always seen through the reference view.
 */
export function anchoredView(
  anchor: SkyAnchor,
  view: Float32Array,
  follow: Float32Array,
  reference: Float32Array,
): Float32Array {
  if (anchor === 'world') return view;
  return multiplyMatrices(view, skyTransform(anchor, follow, reference));
}

/**
 * How the sky is anchored against the camera that sees it: fixed in the world (`world`: moving or
 * turning the camera shows it from elsewhere, nearer or past its edges), moved with the camera's
 * place but keeping its directions in the world (`position`: as a skybox, looking round shows
 * other parts of it, but it never comes nearer), or moved and turned with the camera (`camera`: a
 * fixed backdrop, always as the scene's own camera sees it). Seen from the scene's own camera, all
 * three look the same.
 */
export type SkyAnchor = 'world' | 'position' | 'camera';
