/**
 * The films' legibility floors (tokens.json: hrs-surface-alpha, -raised, -modal): the opacity
 * setting moves each from its floor towards solid, never below it.
 */
const FLOORS = {
  '--hrs-surface-alpha': 0.72,
  '--hrs-surface-alpha-raised': 0.92,
  '--hrs-surface-alpha-modal': 0.9,
} as const;

/** The backdrop blurs when blur is on (tokens.json: hrs-backdrop, -raised, -modal); `none` when off. */
const BLURS = {
  '--hrs-backdrop': 'blur(6px)',
  '--hrs-backdrop-raised': 'blur(10px)',
  '--hrs-backdrop-modal': 'blur(12px) saturate(0.8)',
} as const;

/** The custom properties for the films at `opacity` (0..1), blurred or not. */
export function filmStyle(opacity: number, blur: boolean): Record<string, string> {
  const alphas = Object.entries(FLOORS).map(
    ([property, floor]) => [property, String(Math.round((floor + opacity * (1 - floor)) * 1000) / 1000)] as const,
  );
  const blurs = Object.entries(BLURS).map(([property, on]) => [property, blur ? on : 'none'] as const);
  return Object.fromEntries([...alphas, ...blurs]);
}
