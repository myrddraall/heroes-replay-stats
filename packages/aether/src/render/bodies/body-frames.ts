import { rimTurn } from '../../space/directions';
import type { DrawFrames } from '../../space/graph';
import type { DrawValues } from '../uniforms/shader-uniforms';
import { type Vec3 } from '../../space/vectors';

/**
 * A body's draw's frames as its shader takes them (set as it is baked: they change with the view):
 * its square's frame (`uAxes`, facing the eye) and its surface's (`uFrame`: where its hits, depth
 * and surfaces go back to the world through), the turn between the two (`uSurface`), the eye and
 * the view's right and up in the surface's frame; and the turn its reaches go through into it
 * (`uLightTurn`: see `DrawValues.frameReaches`).
 *
 * Its leans too, the view's wherever the camera goes (see `DrawFrames`): the body's rim (where its
 * rims and glows lean) and its material's spread (where its layers' fresnel is brightest), each
 * taken as the turn of the view it makes (`rimTurn`). The game data's own fresnel turn is a
 * material's look, and stays the view's.
 */
export interface BodyLeans {
  /** The body's rim lean (none: the data's). */
  readonly rim?: Vec3;
  /** The material's spread (none: its layers' own turns). */
  readonly spreadFrom?: Vec3;
}

/** How many layers a material has (`uLayers`). */
const LAYERS = 5;

/** A draw's frames and leans into its values (see `BodyLeans`). */
export function setBodyFrames(u: DrawValues, frames: DrawFrames, leans: BodyLeans): void {
  u.set('uAxes', frames.quad);
  u.set('uFrame', frames.frame);
  u.set('uSurface', frames.surface);
  u.set('uEye', frames.eye);
  u.set('uRight', frames.right);
  u.set('uUp', frames.up);
  u.set('uLightTurn', frames.lightTurn);
  // (As 32-bit floats, as a uniform set holds them: the same numbers as worked out at first.)
  u.set(
    'uRimTurn',
    Float32Array.from(leans.rim ? rimTurn(leans.rim) : [0, 0]),
  );
  if (!leans.spreadFrom) return;
  const [yaw, pitch] = rimTurn(leans.spreadFrom);
  for (let i = 0; i < LAYERS; i++)
    if (u.scalar(`uLayers[${i}].used`) === 1)
      u.set(`uLayers[${i}].fTurn`, Float32Array.of(-yaw, -pitch));
}
