import { type AddedLight, bodyLights, rangeOf, tunedRig } from '../lights/lights';
import { flowLights, type LightBranch, lightsOut } from '../lights/light-flow';
import { aimOf } from '../space/look-at';
import {
  directionToLocal,
  directionToWorld,
  type Mat3,
  placementFrame,
  pointToLocal,
  pointToWorld,
  type Transform,
} from '../space/graph';
import type { PlanetPlacement, Viewpoint } from '../space/space';
import { bodyRigOf } from './drawn-body';

/** A body put up, where it is in its scene's tree (see `LightBranch`), and its library id. */
export interface BranchedPlacement {
  readonly placement: PlanetPlacement;
  readonly branch?: LightBranch;
  readonly id: string;
}

/**
 * The bodies put up, each with the lights that reach it from elsewhere in the scene added after
 * its own (`flowLights`), as they are where they come from: a point or spot light where it is
 * beside its body, as far as it reaches (placed by the scene's camera, `layout`). A body nothing
 * reaches is as it was; none in the tree (no branch) reaches or is reached.
 */
export function withFlowedLights(
  bodies: readonly BranchedPlacement[],
  layout: Viewpoint,
): PlanetPlacement[] {
  const branched = bodies.filter(
    (b): b is BranchedPlacement & { branch: LightBranch } => !!b.branch,
  );
  const byKey = new Map(branched.map((b) => [b.branch.key, b.placement] as const));
  const frame = (p: PlanetPlacement): Transform => ({
    position: p.position,
    rotation: placementFrame(p.position, layout) as unknown as Mat3,
    scale: p.radius,
  });
  const flowed = flowLights(
    branched.map(({ placement, branch, id }) => {
      const { rig, lighting, lightFrom, shade } = bodyRigOf(placement);
      const lit = bodyLights(rig && tunedRig(rig, lighting, lightFrom), shade, placement.lights);
      return { branch, lights: lightsOut(id, lit, placement.added ?? [], placement.lights) };
    }),
    (light, fromKey, toKey) => {
      const from = byKey.get(fromKey);
      const to = byKey.get(toKey);
      return from && to ? movedLight(light, frame(from), frame(to)) : light;
    },
  );
  return bodies.map(({ placement, branch }) => {
    const more = branch && flowed.get(branch.key);
    return more?.length
      ? { ...placement, added: [...(placement.added ?? []), ...more.map((f) => f.light)] }
      : placement;
  });
}

/**
 * A point or spot light beside one body (`from`'s frame, in its radii) as the frame of another has
 * it: where it is, as far as it reaches, the way a spot points; any other as it is.
 */
function movedLight(light: AddedLight, from: Transform, to: Transform): AddedLight {
  if ((light.kind !== 'point' && light.kind !== 'spot') || !light.position) return light;
  const position = pointToLocal(to, pointToWorld(from, light.position));
  const range = (rangeOf(light) * from.scale) / to.scale;
  const spot =
    light.kind === 'spot'
      ? {
          lookAt: {
            kind: 'free' as const,
            direction: directionToLocal(
              to,
              directionToWorld(from, aimOf(light.position, light.lookAt, light.aim)),
            ),
          },
          aim: undefined,
        }
      : {};
  return { ...light, position, range, ...spot };
}
