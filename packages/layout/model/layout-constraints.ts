/**
 * How a layout constrains the children placed in it: the width a `constrained` child is centred
 * within, the padding round a child, and the narrower padding a narrow layout uses.
 */
export interface LayoutConstraints {
  /** CSS pixels. */
  readonly maxWidth: number;
  readonly padding: number;
  readonly narrowPadding: number;
  /** A layout narrower than this (CSS pixels) uses `narrowPadding`. */
  readonly narrowBelow: number;
}

export const DEFAULT_LAYOUT_CONSTRAINTS: LayoutConstraints = {
  maxWidth: 1400,
  padding: 24,
  narrowPadding: 16,
  narrowBelow: 600,
};
