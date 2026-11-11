/** The renderer's tuned numbers: the hex pattern, the bloom, the sky light. */

/** How many hexes a drawn hex pattern has round a body at scale 1, where it doesn't say how many its texture has. */
export const HEX_ROUND = 24;

/**
 * How strongly the bloom is added back, how many times it is blurred across and down, how far
 * apart its taps are (in its texels) and how much smaller than the canvas it is: together, how
 * far it spreads (about a tenth of the view's height).
 */
export const BLOOM_STRENGTH = 1.5;

/** The sky light's texture's size (square). */
export const SKY_LIGHT_SIZE = 64;

export const BLOOM_PASSES = 3;

export const BLOOM_SPACING = 1.5;

export const BLOOM_SCALE = 8;

/** The bloom's threshold where the light doesn't set one: the tutorial's lights' 0.6. */
export const DEFAULT_BLOOM_THRESHOLD = 0.6;
