/** How many of each a draw takes at most: lights, shades, fields, surfaces, spheres, a v table's values. */

/**
 * How many lights that light, and how many that darken, a body is drawn with at most: well past
 * what a scene uses. They are only the size of the draw's table (its lights packed into it, read in
 * one loop as long as the lights it has): a body lit by fewer costs no more for these.
 */
export const MAX_LIGHTS = 32;
export const MAX_SHADES = 16;
/** How many reveals, and how many activations, a grid is drawn with at most (its material's own: one of each). */
export const MAX_FIELDS = 4;

/** How many values a uv sphere's v table has, from the pole to the opposite one (as exported). */
export const V_SAMPLES = 32;

/** How many bodies' surfaces a shape part is hidden behind at most (the nearest first). */
export const MAX_SURFACES = 16;

/** How many bodies' spheres a beam is hidden behind at most (the nearest first). */
export const MAX_BEAM_SPHERES = 16;
