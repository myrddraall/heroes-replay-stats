import type { OpenKind } from './open-target';

/** The library's kinds of thing, as its type choice names them, in its order. */
export const LIBRARY_TYPES: readonly { readonly value: OpenKind; readonly label: string }[] = [
  { value: 'scene', label: 'Scenes' },
  { value: 'planet', label: 'Planets' },
  { value: 'style', label: 'Overlays' },
  { value: 'material', label: 'Materials' },
  { value: 'particle', label: 'Particles' },
  { value: 'sky', label: 'Skies' },
];

export const typeLabel = (type: OpenKind) =>
  LIBRARY_TYPES.find((t) => t.value === type)?.label ?? 'Library';
