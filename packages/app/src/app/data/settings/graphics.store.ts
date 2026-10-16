import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { DEFAULT_DRAWING } from '../../scenes/play-background/background.store';
import { PRESETS } from '../../scenes/play-background/tint-presets';
import { HARDWARE_ACCELERATION } from './hardware-acceleration';

/** Where the look's settings the user chose are kept, as JSON. */
export const GRAPHICS_STORAGE_KEY = 'hrs.graphics';
/** Where the quality is kept: a preset's id (`medium`), or when custom all its settings, as JSON. */
export const QUALITY_STORAGE_KEY = 'hrs.graphics.quality';
/** Where the last custom quality is kept, as JSON, to go back to after trying a preset. */
export const CUSTOM_STORAGE_KEY = 'hrs.graphics.custom';

/** What a quality preset sets: what the site costs to draw. */
export interface GraphicsQuality {
  /** Whether the background moves; when not, it is drawn once for each page, cross-fading from the last. */
  readonly animate: boolean;
  /** The background's frames a second at most while it just moves. */
  readonly idleFps: number;
  /** Its frames a second at most while it fades. */
  readonly animationFps: number;
  /** Its frames a second at most while something interactive asks for it (the map, dragged). */
  readonly interactingFps: number;
  /** The share of the display's resolution the background is drawn at. */
  readonly resolution: number;
  /** Whether the glass blurs what is behind it: redone for every frame of the background. */
  readonly blur: boolean;
}

/** The neutral the site is in. */
export type GraphicsTheme = 'neutral' | 'nexus';
/** The background's colour: the one chosen, or a preset at random or the next one, each page. */
export type ColourMode = 'fixed' | 'random' | 'in-turn';

export interface GraphicsSettings extends GraphicsQuality {
  readonly theme: GraphicsTheme;
  readonly colourMode: ColourMode;
  /** The tint preset (by id) the background is in, when fixed. */
  readonly colour: string;
  /** How see-through the glass panels are (their opacity). */
  readonly glassAlpha: number;
  /** How see-through the frame is (the menu and the header). */
  readonly frameAlpha: number;
}

export const QUALITIES = ['low', 'medium', 'high', 'ultra', 'extreme'] as const;
export type Quality = (typeof QUALITIES)[number];

export const QUALITY_LABELS: Readonly<Record<Quality, string>> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
  extreme: 'Extreme',
};

/** The quality presets, as in a game's graphics settings: High is the default. */
export const QUALITY_PRESETS: Readonly<Record<Quality, GraphicsQuality>> = {
  low: { animate: false, idleFps: 12, animationFps: 30, interactingFps: 0, resolution: 0.5, blur: false },
  medium: { animate: true, idleFps: 8, animationFps: 30, interactingFps: 0, resolution: 0.75, blur: false },
  high: { ...DEFAULT_DRAWING, blur: false },
  ultra: { animate: true, idleFps: 30, animationFps: 60, interactingFps: 15, resolution: 1, blur: true },
  extreme: { animate: true, idleFps: 60, animationFps: 120, interactingFps: 60, resolution: 1, blur: true },
};

export const FPS_RANGE = { min: 1, max: 120 } as const;
/** Down to none: the background stops while something interactive has the page. */
export const INTERACTING_FPS_RANGE = { min: 0, max: 120 } as const;
export const RESOLUTION_RANGE = { min: 0.25, max: 1 } as const;
/** The glass opacity below which muted text loses WCAG AA contrast over the background's brightest sky. */
export const GLASS_ALPHA_RANGE = { min: 0.06, max: 1 } as const;

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  ...QUALITY_PRESETS.high,
  theme: 'neutral',
  colourMode: 'fixed',
  colour: PRESETS[0]!.id,
  glassAlpha: 0.5,
  frameAlpha: 0.55,
};

const QUALITY_KEYS = Object.keys(QUALITY_PRESETS.high) as (keyof GraphicsQuality)[];

/** The preset the settings are at; custom when they are at none. */
export function qualityOf(settings: GraphicsQuality): Quality | 'custom' {
  return (
    QUALITIES.find((q) => QUALITY_KEYS.every((k) => QUALITY_PRESETS[q][k] === settings[k])) ??
    'custom'
  );
}

function number(v: unknown, { min, max }: { min: number; max: number }, step: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const perUnit = Math.round(1 / step); // dividing by it keeps 0.75 exact, as the presets have it
  return Math.min(max, Math.max(min, Math.round(v * perUnit) / perUnit));
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T | undefined {
  return values.find((x) => x === v);
}

/** What the user chose, each value kept within its range; one that isn't a value is left out. */
function valid(saved: Partial<Record<keyof GraphicsSettings, unknown>>): Partial<GraphicsSettings> {
  const chosen: Partial<Record<keyof GraphicsSettings, unknown>> = {
    animate: typeof saved.animate === 'boolean' ? saved.animate : undefined,
    idleFps: number(saved.idleFps, FPS_RANGE, 1),
    animationFps: number(saved.animationFps, FPS_RANGE, 1),
    interactingFps: number(saved.interactingFps, INTERACTING_FPS_RANGE, 1),
    resolution: number(saved.resolution, RESOLUTION_RANGE, 0.05),
    blur: typeof saved.blur === 'boolean' ? saved.blur : undefined,
    theme: oneOf(saved.theme, ['neutral', 'nexus'] as const),
    colourMode: oneOf(saved.colourMode, ['fixed', 'random', 'in-turn'] as const),
    colour: oneOf(saved.colour, PRESETS.map((p) => p.id)),
    glassAlpha: number(saved.glassAlpha, GLASS_ALPHA_RANGE, 0.01),
    frameAlpha: number(saved.frameAlpha, GLASS_ALPHA_RANGE, 0.01),
  };
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v !== undefined),
  ) as Partial<GraphicsSettings>;
}

/** A quality's values, when all of them are there and valid. */
function validQuality(v: unknown): GraphicsQuality | null {
  if (typeof v !== 'object' || v === null) return null;
  const kept = valid(v as Partial<Record<keyof GraphicsSettings, unknown>>);
  if (!QUALITY_KEYS.every((k) => kept[k] !== undefined)) return null;
  return Object.fromEntries(QUALITY_KEYS.map((k) => [k, kept[k]])) as unknown as GraphicsQuality;
}

/** The look's settings: the rest of the Graphics settings, which the presets don't set. */
type GraphicsLook = Omit<GraphicsSettings, keyof GraphicsQuality>;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the settings still apply until the page closes
  }
}

function parse(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The quality kept: a preset's values, by its id, or the custom values themselves. */
function loadQuality(): GraphicsQuality | null {
  const raw = read(QUALITY_STORAGE_KEY);
  const preset = oneOf(raw, QUALITIES);
  return preset ? QUALITY_PRESETS[preset] : validQuality(parse(raw));
}

/** The quality kept: a preset's id, or (custom) all of its values as JSON. */
function saveQuality(values: GraphicsQuality): void {
  const quality = qualityOf(values);
  write(QUALITY_STORAGE_KEY, quality === 'custom' ? JSON.stringify(values) : quality);
}

/** The look's settings the user chose. */
function loadLook(): Partial<GraphicsLook> {
  const saved = parse(read(GRAPHICS_STORAGE_KEY));
  if (typeof saved !== 'object' || saved === null) return {};
  const kept: Partial<GraphicsSettings> = valid(saved as Partial<Record<keyof GraphicsSettings, unknown>>);
  for (const k of QUALITY_KEYS) delete kept[k];
  return kept;
}

/**
 * The Graphics settings: the quality (a preset, or custom as soon as one of its values is changed),
 * the theme, the background's colour and the glass, kept in `localStorage`: the quality as its
 * preset's id, or all its settings when custom; the look's settings the user chose. Until chosen,
 * they are the defaults: High, or Low where the browser draws without hardware acceleration (it
 * costs the CPU dearly then). Until a quality is chosen it is detected again on each load, so
 * turning acceleration on or off shows; once chosen, never.
 * The last custom quality is kept too: a change that leaves the quality at no preset becomes it, and
 * choosing a preset leaves it, so it can be had back.
 */
export const GraphicsStore = signalStore(
  { providedIn: 'root' },
  withState<GraphicsSettings & { custom: GraphicsQuality | null }>({
    ...DEFAULT_GRAPHICS,
    custom: null,
  }),
  withComputed((store) => {
    const values = computed(
      (): GraphicsQuality => ({
        animate: store.animate(),
        idleFps: store.idleFps(),
        animationFps: store.animationFps(),
        interactingFps: store.interactingFps(),
        resolution: store.resolution(),
        blur: store.blur(),
      }),
    );
    return {
      /** The quality's values as they are. */
      qualityValues: values,
      /** The quality preset the settings are at; custom when they are at none. */
      quality: computed(() => qualityOf(values())),
    };
  }),
  withMethods((store) => {
    /** The settings at no preset are the custom quality from now on. */
    const keepCustom = () => {
      if (store.quality() === 'custom') patchState(store, { custom: store.qualityValues() });
    };
    /** Changes the settings given (each kept within its range), and remembers them on this device. */
    const set = (changes: Partial<GraphicsSettings>): void => {
      const kept = valid(changes);
      patchState(store, kept);
      const keys = Object.keys(kept) as (keyof GraphicsSettings)[];
      if (keys.some((k) => QUALITY_KEYS.includes(k as keyof GraphicsQuality))) {
        keepCustom();
        saveQuality(store.qualityValues());
        const custom = store.custom();
        if (custom) write(CUSTOM_STORAGE_KEY, JSON.stringify(custom));
      }
      const look = Object.fromEntries(
        Object.entries(kept).filter(([k]) => !QUALITY_KEYS.includes(k as keyof GraphicsQuality)),
      );
      if (Object.keys(look).length) {
        write(GRAPHICS_STORAGE_KEY, JSON.stringify({ ...loadLook(), ...look }));
      }
    };
    return {
      set,
      /** Sets the quality's values to a preset's; the last custom quality is kept. */
      setQuality(quality: Quality): void {
        set(QUALITY_PRESETS[quality]);
      },
      /** Back to the last custom quality, if there is one. */
      restoreCustom(): void {
        const custom = store.custom();
        if (custom) set(custom);
      },
    };
  }),
  withHooks({
    onInit(store) {
      // Without it, Low: the CPU draws it all then.
      const detected = inject(HARDWARE_ACCELERATION) ? 'high' : 'low';
      patchState(store, loadLook(), loadQuality() ?? QUALITY_PRESETS[detected], {
        custom: validQuality(parse(read(CUSTOM_STORAGE_KEY))),
      });
      if (store.quality() === 'custom') patchState(store, { custom: store.qualityValues() });
    },
  }),
);
