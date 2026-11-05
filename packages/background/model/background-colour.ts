import { PRESETS } from './tint-presets';

/** The background's colour: the one chosen, or a preset at random or the next one, each page. */
export type ColourMode = 'fixed' | 'random' | 'in-turn';
export const COLOUR_MODES: readonly ColourMode[] = ['fixed', 'random', 'in-turn'];

export interface BackgroundColour {
  readonly colourMode: ColourMode;
  /** The tint preset (by id) the background is in, when fixed. */
  readonly colour: string;
}

export const DEFAULT_COLOUR: BackgroundColour = { colourMode: 'fixed', colour: PRESETS[0]!.id };
