import type { PartRole } from './part-shapes';

/**
 * A part of a placed body by whose it is and which part of it it is: the body's own by its part
 * (`own:surface`), or an overlay's it wears by the overlay and its part (`style:nexus:shield`),
 * so overlays worn together keep their parts apart.
 */
export type PartKey = `own:${string}` | `style:${string}:${string}`;

/** Which of its owner's parts a part is: its id, where it has one (an overlay made in the editor), else its role. */
export const partId = (part: { readonly id?: string; readonly role: PartRole }) =>
  part.id ?? part.role;

/** A body's own part's key. */
export const ownPartKey = (part: { readonly id?: string; readonly role: PartRole }): PartKey =>
  `own:${partId(part)}`;

/** An overlay's part's key, the overlay worn by its id. */
export const overlayPartKey = (
  overlay: string,
  part: { readonly id?: string; readonly role: PartRole },
): PartKey => `style:${overlay}:${partId(part)}`;

/** The overlay a part's key is of (none: the body's own). */
export const overlayOfPartKey = (key: PartKey): string | undefined =>
  key.startsWith('style:') ? key.split(':')[1] : undefined;
