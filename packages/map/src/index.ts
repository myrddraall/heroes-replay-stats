// The map viewer: a heroes-capture map pack (served by heroes-maps) drawn by the presentational
// `hrs-map-viewer`, which renders the pack's own layers from its data and any layer directive
// placed in it; `hrs-map` is the container that loads a map by id and keeps what is shown.

// data-access: the pack format, the catalog, and loading a map
export type * from './lib/pack/map-pack';
export { readableMaps, type MapCatalog, type MapCatalogEntry } from './lib/pack/map-catalog';
export type { MapAssets, MapViewModel, TileArchive } from './lib/pack/map-assets';
export { HttpMapAssets } from './lib/pack/http-map-assets';
export { MAP_PACKS_URL, MapPacksService } from './lib/pack/map-packs.service';
export { MapCatalogStore, type MapCatalogItem } from './lib/pack/map-catalog.store';

// util: arenas, the camera and projections, the layer stack
export { arenasOf, type Arena } from './lib/view/arenas';
export {
  projection,
  type Camera,
  type LayerProjection,
  type ViewPoint,
  type Viewport,
} from './lib/view/camera';
export {
  DEFAULT_ORDER,
  DEFAULT_RATE,
  ORDER_STEP,
  packStack,
  resolvePlacement,
  type LayerPlacement,
  type StackedLayer,
} from './lib/view/layer-stack';

// ui: the viewer, its layers, and what a custom layer builds on
export { MapViewer } from './lib/viewer/map-viewer';
export { MapViewerStore, type MapViewerBars } from './lib/viewer/map-viewer.store';
export { MapViewerBar, type BarContext, type BarSide } from './lib/viewer/map-viewer-bar';
export { MapRenderer } from './lib/viewer/map-renderer';
export { MapLayerPlacement } from './lib/viewer/map-layer-placement';
export {
  LAYER_DONE,
  type LayerFrame,
  type MapFrame,
  type MapLayer,
  type MapLayerStatus,
  type MapView,
} from './lib/viewer/map-layer';
export { frameContext, LAYER_STYLE } from './lib/viewer/canvas';
export { MapFixedLayer } from './lib/layers/map-fixed-layer';
export { MapTileLayer } from './lib/layers/map-tile-layer';
export { MapElementsLayer } from './lib/layers/elements/map-elements-layer';
export type {
  CampShown,
  ElementKind,
  ElementShown,
  StructureShown,
} from './lib/layers/elements/element-pieces';
export { MapMinimapLayer } from './lib/layers/minimap/map-minimap-layer';

// feature: the container
export { HeroesMap } from './lib/map/heroes-map';
export { MapStore } from './lib/map/map.store';
