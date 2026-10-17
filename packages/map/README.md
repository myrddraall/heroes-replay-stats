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

| Layer       | Folder               | What                                                                                                                                                                                                                       |
| ----------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| data-access | `pack/`              | The pack format, `MapPacksService` (reads a map: its `pack.json` and a `MapAssets` data source), `MapsStore` (global: the catalog and the packs; all loading of map data happens here), the pure `poisOf` and `mapFactsOf` |
| util        | `view/`              | Arenas, the camera and its projections, the layer stack (`packStack`, `resolvePlacement`), the framing (`framing.ts`)                                                                                                      |
| ui          | `viewer/`, `layers/` | The presentational viewer and its layer directives                                                                                                                                                                         |
| feature     | `map/`               | `hrs-map`, the container                                                                                                                                                                                                   |

- **`hrs-map` (`HeroesMap`, container):** takes a map id. Its component store (`MapStore`) is two store features over the global `MapsStore`: `withMapPack()` (which map, and the map as the global store has it: `map`, `pack`, `loading`, `error`; `showMap`, `minimapFaded`) and `withElementStates()` (each structure's and camp's state: `elementStates`, `setElementState`, `cycleElement`, `resetElements`). A container of your own composes the same features and adds its UI state; the loading is never its own. It hands all of that to the viewer, and handles the viewer's events (a click on an element steps it to its next state; the minimap's loading screen fading away turns it off). While that loading screen is up the other layers are drawn at alpha 0; once the first view is fully drawn they cross-fade: the minimap out, the map in (`--hrs-map-viewer-fade`, 600 ms).
- **`hrs-map-viewer` (`MapViewer`, presentational):** takes `map` (the pack and its `MapAssets`), `loading`, `error`, `arena`, `hiddenLayers`, `elementStates`, `selected` (the structure or camp picked, by key: it glows strongly, hovered or not; the hovered one glows softly; both in the element's side's colour — Order blue, Chaos red, yellow for the neutral camps — or as the custom properties `--hrs-map-glow-order`, `--hrs-map-glow-order-hover`, and so for `chaos` and `neutral`, set on the viewer) and `centreOn` (a `CentreRequest`, `{ cell, minZoom? }`: each new object brings that place into view, as far as the view's limits allow), and emits `elementClick`, `mapClick` (a click nothing takes: the cell), `minimapFaded` and `inUse` (true while it is dragged, zoomed with the wheel or moved with the keys, false a moment after: what else the page draws can make room for it meanwhile). It renders the pack's own layers from the pack's data, and draws them over a frame loop (`MapRenderer`). It keeps only UI state: the camera (`MapViewerStore`, a presenter store) and the hover. It never fetches: tiles, pictures and the minimap's SVG come from the `MapAssets` it is given.

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

### A mode of your own

A use of the map (exploring it, a match's heat map, a replay's timeline) is a container of its own:
its component store composes `withMapPack()` and `withElementStates()` over the global `MapsStore`
and adds the mode's UI state; its template is `hrs-map-viewer` with the mode's layer directives
projected in, and whatever UI goes round it. The app's explore mode (`hrs-map-explore`) is one:

```ts
export const MapExploreStore = signalStore(
  withMapPack(),
  withElementStates(),
  withState({ selected: null as string | null, centre: null as CentreRequest | null }),
  withComputed(({ pack }) => ({ pois: computed(() => (pack() ? poisOf(pack()!) : [])) })),
  withMethods((store) => ({
    load: signalMethod<string>((id) => {
      store.resetElements();
      store.showMap(id);
    }),
    select(key: string) {
      patchState(store, { selected: key });
    },
  })),
);
```

```html
<hrs-map-viewer
  [map]="store.map()"
  [loading]="store.loading()"
  [error]="store.error()"
  [elementStates]="store.elementStates()"
  [selected]="store.selected()"
  [centreOn]="store.centre()"
  (elementClick)="store.select($event)"
  (mapClick)="store.deselect()"
/>
```

`poisOf(pack)` lists the pack's structures and camps by team (Order, Chaos, neutral), each in
groups (the core, the towns, their outposts, the camps) with labels (`structureLabel`,
`campLabel`); `allPois(teams)` is the same flat, in list order; `mapFactsOf(pack)` is what the
pack says of the map.

## Tests

`pnpm test` runs the plain logic (arenas, camera maths and projections, the layer stack, tile
pyramids, element hit-testing and masks, element states) against two real `pack.json` files in
`test/fixtures/`.
