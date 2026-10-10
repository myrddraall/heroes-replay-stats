# @myrddraall/heroes-replay-stats-map

The map viewer. It shows a map pack: what
[heroes-capture](https://github.com/myrddraall/heroes-capture) renders for each battleground,
in the format its `PACK.md` describes. The packs are served by GitHub Pages from
[myrddraall/heroes-maps](https://github.com/myrddraall/heroes-maps)
(`https://myrddraall.github.io/heroes-maps/maps/`; another location through the
`MAP_PACKS_URL` token).

The logic is ported from heroes-capture's reference viewer (`src/heroes_capture/viewer.html`),
split into a viewer and the layers placed in it.

## Architecture

Container / presentational (smart / dumb) components, with NgRx `signalStore`s:

| Layer       | Folder               | What                                                                                                                        |
| ----------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| data-access | `pack/`              | The pack format, `MapPacksService` (loads a map: its `pack.json` and a `MapAssets` data source), `MapCatalogStore` (global) |
| util        | `view/`              | Arenas, the camera and its projections, the layer stack (`packStack`, `resolvePlacement`), the framing (`framing.ts`)       |
| ui          | `viewer/`, `layers/` | The presentational viewer and its layer directives                                                                          |
| feature     | `map/`               | `hrs-map`, the container                                                                                                    |

- **`hrs-map` (`HeroesMap`, container):** takes a map id. Its component store (`MapStore`) loads the map and keeps what is shown: the hidden layers, the arena, and each structure's and camp's state. It hands all of that to the viewer, and handles the viewer's events (a click on an element steps it to its next state; the minimap's loading screen fading away turns it off). While that loading screen is up the other layers are drawn at alpha 0; once the first view is fully drawn they cross-fade: the minimap out, the map in (`--hrs-map-viewer-fade`, 600 ms).
- **`hrs-map-viewer` (`MapViewer`, presentational):** takes `map` (the pack and its `MapAssets`), `loading`, `error`, `arena`, `hiddenLayers` and `elementStates`, and emits `elementClick` and `minimapFaded`. It renders the pack's own layers from the pack's data, and draws them over a frame loop (`MapRenderer`). It keeps only UI state: the camera (`MapViewerStore`, a presenter store) and the hover. It never fetches: tiles, pictures and the minimap's SVG come from the `MapAssets` it is given.

  Zoomed out all the way it shows, in order: the whole playable area (the camera bounds), centred; then as much of the map round it as it can, a margin of up to a tenth of its size (`PLAYABLE_MARGIN`); and never an edge of the sky (each sky layer's picture fills its rectangle: heroes-capture's PACK.md, Sky layers fill their rectangles). The margin shrinks as far as the sky needs for the viewer's size. Only when even no margin is filled is the map drawn in a narrower or shorter view, centred, between bars: one pair, left and right or top and bottom, the same thickness, depending on the viewer's size and zoom only (never on panning). They are two elements beside the view, black, or `--hrs-map-viewer-bars` (any `background`), or filled with an `ng-template[hrsMapViewerBar]` placed inside the viewer (rendered in each bar, given its side). They are part of the map: hidden while the minimap's loading screen is up, they fade in with it. The viewer has no background of its own: the page shows through the view until the map is drawn, and wherever the map is transparent. With `bars="shrink"` (on the viewer or on `hrs-map`) they recede as the camera zooms in, as far as the sky fills the view at that zoom:

  ```html
  <hrs-map-viewer [map]="map" style="--hrs-map-viewer-bars: #111">
    <ng-template hrsMapViewerBar let-side>
      <img [src]="side === 'left' || side === 'top' ? 'frame-start.png' : 'frame-end.png'" alt="" />
    </ng-template>
  </hrs-map-viewer>
  ```

- **The layers** are directives on elements: `div[hrsMapFixedLayer]`, `canvas[hrsMapTileLayer]`, `canvas[hrsMapElementsLayer]` and `hrs-map-minimap-layer`.

### Layer order and parallax

Every layer has a placement: an `order` (back to front; the renderer sets the element's `z-index` from it) and a parallax `rate` (1 moves with the map, less for a plane further back, 0 not at all). The pack's own layers take theirs from the pack: its layers in the order it lists them, 10 apart (all map layers as one, the terrain), the sky layers at their own rate, then the elements and the minimap just in front of the terrain.

Each frame, a layer gets a `LayerFrame` with the `projection` of its rate: `toScreen(cell)`, `toCell(point)`, and its scales.

### A layer of your own

A custom layer is a directive placed inside the viewer, in the container's template; its inputs and outputs bind to the container. It composes `MapLayerPlacement` for its `order` and `rate` inputs, implements `MapLayer` (`render`, and `hover`/`click` if it reacts to the pointer), and registers with `MapRenderer`. `order` and `rate` take a number, or one of the pack's layers by id: `order="elements"` sits just in front of the elements, `rate="haze"` moves with the haze.

```html
<hrs-map-viewer [map]="store.map()" (elementClick)="store.cycleElement($event)">
  <canvas myHeroesLayer order="elements" rate="map" [heroes]="store.heroes()"></canvas>
</hrs-map-viewer>
```

The package is private and consumed from source, as `packages/analysers` is. The app's dev
server keeps it out of Vite's dependency pre-bundling (`prebundle.exclude` in `angular.json`)
so that the Angular compiler compiles it. The app also lists its runtime dependency
(`pmtiles`), so that pre-bundling finds it.

## Tests

`pnpm test` runs the plain logic (arenas, camera maths and projections, the layer stack, tile
pyramids, element hit-testing and masks, element states) against two real `pack.json` files in
`test/fixtures/`.
