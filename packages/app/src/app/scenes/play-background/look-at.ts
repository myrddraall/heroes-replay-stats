import { normalized, type Vec3 } from './scene-directions';

/**
 * What something that points (a spot light; a camera, later) looks at: its body (a spot on its
 * face, `at`: a point on the unit sphere, in the body's frame; none: the body's middle), or a
 * direction of its own (the body's frame). Shared by whatever looks, so the editor shows one
 * control for it.
 */
export type LookAt =
  | { readonly kind: 'body'; readonly at?: Vec3 }
  | { readonly kind: 'free'; readonly direction: Vec3 };

/** The way from `position` to the middle: at the body's middle. */
export const aimAtMiddle = (position: Vec3): Vec3 =>
  normalized([-position[0], -position[1], -position[2]]).map((v) => v || 0) as unknown as Vec3;

/**
 * The way something at `position` (the body's frame, in its radii) points: at what it looks at;
 * where nothing is set, along `aim` (the direction kept from before), else at the body's middle.
 */
export function aimOf(position: Vec3, lookAt: LookAt | undefined, aim?: Vec3): Vec3 {
  if (lookAt?.kind === 'free') return normalized(lookAt.direction);
  if (lookAt?.kind === 'body') {
    if (!lookAt.at) return aimAtMiddle(position);
    const at = normalized(lookAt.at);
    return normalized([at[0] - position[0], at[1] - position[1], at[2] - position[2]]);
  }
  return aim ? normalized(aim) : aimAtMiddle(position);
}

/**
 * The spot on the body's face something at `position` is aimed at (a point on the unit sphere):
 * as set, or, aimed at the middle, the face nearest it.
 */
export function aimedPoint(position: Vec3, lookAt: LookAt | undefined): Vec3 {
  return lookAt?.kind === 'body' && lookAt.at ? normalized(lookAt.at) : normalized(position);
}
