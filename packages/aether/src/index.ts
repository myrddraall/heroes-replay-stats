// Aether's root entry: what an app sets it up with, and its shared state. The rest is in an entry
// per area (`@myrddraall/heroes-replay-stats-aether/<area>`), so what an app loads at once stays small.
export { DATA_URL } from './formats/data-url';
export { type AetherOptions, provideAether } from './provide-aether';
export { RENDER_API, type RenderApi } from './render/render-api';
export { STORAGE_NAMES, storageKey, type StorageNames } from './storage/storage-names';
export { presetColour, presetTints, TINT_PRESETS, type TintPreset } from './tints/tint-presets';
export { DEFAULT_DRAWING, type Release, ViewStore, type ViewDrawing } from './view/view.store';
