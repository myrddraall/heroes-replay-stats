import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  type BackgroundColour,
  COLOUR_MODES,
  DEFAULT_COLOUR,
  PRESETS,
} from '../model';

/** Where the colour the user chose is kept, as JSON: where the Graphics settings kept it. */
export const COLOUR_STORAGE_KEY = 'hrs.graphics';

/** What the user chose; one that isn't a value is left out. */
function valid(saved: Partial<Record<keyof BackgroundColour, unknown>>): Partial<BackgroundColour> {
  const chosen = {
    colourMode: COLOUR_MODES.find((m) => m === saved.colourMode),
    colour: PRESETS.find((p) => p.id === saved.colour)?.id,
  };
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v !== undefined),
  ) as Partial<BackgroundColour>;
}

/** What is kept under the key: the colour, and whatever else the Graphics settings kept there. */
function saved(): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(COLOUR_STORAGE_KEY) ?? 'null');
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The background's colour, kept in `localStorage` once the user chooses it. */
export const BackgroundColourStore = signalStore(
  { providedIn: 'root' },
  withState<BackgroundColour>(DEFAULT_COLOUR),
  withMethods((store) => ({
    /** Changes the colour (the mode or the preset), and remembers it on this device. */
    set(changes: Partial<BackgroundColour>): void {
      const kept = valid(changes);
      patchState(store, kept);
      try {
        localStorage.setItem(COLOUR_STORAGE_KEY, JSON.stringify({ ...valid(saved()), ...kept }));
      } catch {
        // storage unavailable: the colour still applies until the page closes
      }
    },
  })),
  withHooks({
    onInit(store) {
      patchState(store, valid(saved()));
    },
  }),
);
