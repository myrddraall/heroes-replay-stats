import type { RenderApi } from '../render/render-api';
import { DEFAULT_DRAWING, type ViewDrawing } from '../view/view.store';

/** What a quality preset sets: what the background costs to draw. */
export type GraphicsQuality = ViewDrawing;

export const QUALITIES = ['low', 'medium', 'high', 'ultra', 'extreme'] as const;
export type Quality = (typeof QUALITIES)[number];

/** The quality presets, as in a game's graphics settings: High is the default. */
export const QUALITY_PRESETS: Readonly<Record<Quality, GraphicsQuality>> = {
  low: { animate: false, idleFps: 12, animationFps: 30, interactingFps: 0, resolution: 0.5 },
  medium: { animate: true, idleFps: 8, animationFps: 30, interactingFps: 0, resolution: 0.75 },
  high: DEFAULT_DRAWING,
  ultra: { animate: true, idleFps: 30, animationFps: 60, interactingFps: 15, resolution: 1 },
  extreme: { animate: true, idleFps: 60, animationFps: 120, interactingFps: 60, resolution: 1 },
};

export const RENDER_APIS: readonly RenderApi[] = ['auto', 'webgpu', 'webgl2'];

export const FPS_RANGE = { min: 1, max: 120 } as const;
/** Down to none: the background stops while something interactive has the page. */
export const INTERACTING_FPS_RANGE = { min: 0, max: 120 } as const;
export const RESOLUTION_RANGE = { min: 0.25, max: 1 } as const;

/** The engine's graphics settings: the quality's values and the graphics API. */
export interface GraphicsSettings extends GraphicsQuality {
  /** What the background draws with. */
  readonly api: RenderApi;
}

export const QUALITY_KEYS = Object.keys(QUALITY_PRESETS.high) as (keyof GraphicsQuality)[];

/** The preset the settings are at; custom when they are at none. */
export function qualityOf(settings: GraphicsQuality): Quality | 'custom' {
  return (
    QUALITIES.find((q) => QUALITY_KEYS.every((k) => QUALITY_PRESETS[q][k] === settings[k])) ??
    'custom'
  );
}

function number(
  v: unknown,
  { min, max }: { min: number; max: number },
  step: number,
): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  const perUnit = Math.round(1 / step); // dividing by it keeps 0.75 exact, as the presets have it
  return Math.min(max, Math.max(min, Math.round(v * perUnit) / perUnit));
}

/** What the user chose, each value kept within its range; one that isn't a value is left out. */
export function validGraphics(
  saved: Partial<Record<keyof GraphicsSettings, unknown>>,
): Partial<GraphicsSettings> {
  const chosen: Partial<Record<keyof GraphicsSettings, unknown>> = {
    animate: typeof saved.animate === 'boolean' ? saved.animate : undefined,
    idleFps: number(saved.idleFps, FPS_RANGE, 1),
    animationFps: number(saved.animationFps, FPS_RANGE, 1),
    interactingFps: number(saved.interactingFps, INTERACTING_FPS_RANGE, 1),
    resolution: number(saved.resolution, RESOLUTION_RANGE, 0.05),
    api: RENDER_APIS.find((a) => a === saved.api),
  };
  return Object.fromEntries(
    Object.entries(chosen).filter(([, v]) => v !== undefined),
  ) as Partial<GraphicsSettings>;
}

/** A quality's values, when all of them are there and valid. */
export function validQuality(v: unknown): GraphicsQuality | null {
  if (typeof v !== 'object' || v === null) return null;
  const kept = validGraphics(v as Partial<Record<keyof GraphicsSettings, unknown>>);
  if (!QUALITY_KEYS.every((k) => kept[k] !== undefined)) return null;
  return Object.fromEntries(QUALITY_KEYS.map((k) => [k, kept[k]])) as unknown as GraphicsQuality;
}
