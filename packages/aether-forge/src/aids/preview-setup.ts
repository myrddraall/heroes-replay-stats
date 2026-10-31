import type { Backdrop } from '@myrddraall/heroes-replay-stats-aether/space';
import {
  type BackdropFill,
  GRID_COLOURS,
  GRID_SQUARE,
  type GridSize,
  type StandInFill,
} from './editing-aids.store';

/**
 * What a library item is previewed with on its Preview stage (an editing aid, kept in this browser,
 * never in the design): what is behind it (a sky, a plain colour, or a grid; which sky, which
 * colour, how big the grid's squares), the stand-in planet's fill (a colour, or the grid), and the
 * planet an overlay is shown worn by (none: the stand-in).
 */
export interface PreviewSetup {
  readonly backdrop: BackdropFill;
  readonly backdropSky: string;
  readonly backdropColour: string;
  readonly gridSize: GridSize;
  readonly standIn: StandInFill;
  readonly standInColour: string;
  readonly planet: string | null;
}

/** The kinds of library item kept a setup of their own (scenes and groups are edited in place). */
export type PreviewKind = 'planet' | 'style' | 'material' | 'particle' | 'sky';

const ON_GRID: PreviewSetup = {
  backdrop: 'grid',
  backdropSky: 'play',
  backdropColour: '#000000',
  gridSize: 'medium',
  standIn: 'grid',
  standInColour: '#9a9a9a',
  planet: null,
};

/**
 * What a kind of item is previewed with until it (or its kind) is set otherwise: a planet on the
 * game's sky; an overlay, or a planet's material, on the stand-in over the grid; a material that
 * glows (its light added) and particles against black. (What is part of the sky is shown on it,
 * whatever is set: see the stage.)
 */
export function previewDefault(kind: PreviewKind, glows = false): PreviewSetup {
  if (kind === 'planet' || kind === 'sky') return { ...ON_GRID, backdrop: 'sky' };
  if (kind === 'particle' || glows) return { ...ON_GRID, backdrop: 'colour' };
  return ON_GRID;
}

/** `#rrggbb` as 0 to 1. */
const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** A setup's backdrop as the renderer takes it (none: the sky). */
export function backdropOf(setup: PreviewSetup): Backdrop | null {
  switch (setup.backdrop) {
    case 'sky':
      return null;
    case 'colour':
      return { kind: 'colour', colour: rgb(setup.backdropColour) };
    case 'grid':
      return {
        kind: 'grid',
        size: GRID_SQUARE[setup.gridSize],
        colours: [rgb(GRID_COLOURS[0]), rgb(GRID_COLOURS[1])],
      };
  }
}
