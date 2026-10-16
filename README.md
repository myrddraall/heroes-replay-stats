# Heroes Replay Stats

Statistics from your Heroes of the Storm replays — an Angular app that runs in the
browser and, through a thin Electron shell, on the desktop. Everything happens on your
device: replays are parsed locally and stored in IndexedDB; there is no account, no
login and no server.

| Package                                                             | What it is                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@myrddraall/heroes-replay-stats`](./packages/app)                 | the Angular 22 + Material app, themed after the game                  |
| [`@myrddraall/heroes-replay-stats-desktop`](./packages/desktop)     | the Electron shell: a window, and a preload bridge for the filesystem |
| [`@myrddraall/heroes-replay-stats-analysers`](./packages/analysers) | the app's own replay analysers: timeline and points of interest       |
| [`@myrddraall/heroes-replay-stats-map`](./packages/map)             | the map viewer: a map pack drawn by a viewer and its layer directives |

The replay parsing, the model and the generic analysers come from
[myrddraall/heroprotocol](https://github.com/myrddraall/heroprotocol). The app's ingest
worker runs those next to its own analysers from `packages/analysers`.

The tool that renders the battleground maps (transparent map images, sky layers, a parallax
viewer), which began here as `tools/map-capture`, is now
[myrddraall/heroes-capture](https://github.com/myrddraall/heroes-capture).

## Working on it

```bash
pnpm install
pnpm start          # Angular dev server on http://localhost:4200
pnpm desktop        # Electron against the dev server (needs `pnpm start` running)
pnpm build          # every package
pnpm test           # every package with tests
pnpm lint
pnpm typecheck
pnpm check          # pinned dependency versions agree
pnpm run generate.analysis-goldens  # after changing an app analyser's output
```

The app talks to its host through one seam, `Platform` (`packages/app/src/app/platform`):
the browser build picks files with an `<input type=file>`, the desktop build through
Electron's dialog and knows the game's replay folder. Nothing else in the app knows
where it runs.

## Maps rendered on this machine

The app reads its maps from [heroes-maps](https://github.com/myrddraall/heroes-maps). In the
devcontainer (`DEV_LOCAL` is true there) `pnpm start` and `pnpm build` add the app's `local`
configuration instead, which reads them from this machine:

```bash
pnpm run serve.maps                 # heroes-capture's output next to this repository (../heroes-capture/tmp/results/maps)
pnpm run serve.maps <folder> [port] # another folder of renders
pnpm start                          # the app on http://localhost:4200, its /maps-local/ proxied to the maps server
```

The maps server (port 4208) serves whatever renders are in the folder (a catalog, each pack, byte
ranges), read afresh on every request, so a new render shows on the next reload. The dev server
proxies `/maps-local/` to it, so from outside the container only port 4200 is needed.
`pnpm start -- --configuration production` serves the production bundle the same way. CI builds,
where `DEV_LOCAL` isn't set, read heroes-maps as before; nothing changes at check-in.

## The Play screen background

`/play-background` is the game's Play screen background on a page of its own, filling the
window: its sky, the energy drifting in towards the horizon, the twinkling stars and the planets, drawn with
WebGL from the game's own camera, meshes, materials and particles (`hrs-play-background`,
`packages/app/src/app/scenes/play-background`, fills whatever element holds it).
The site's background is one instance in the shell, behind every page. `BackgroundStore`
(`packages/app/src/app/scenes/play-background/background.store.ts`) holds how it is tinted, as the
game turns it blue for vs A.I.: a colour and a blend (`multiply`, `color`, `hue`, `overlay`,
`soft-light`, `color-burn` or `saturation`, as CSS blends them) for the whole of it, and for each
planet on its own; a change fades over half a second. The site's tints are the Graphics settings'
colour; a page can hold its own over them while it is open (`setPageTints`, the Background page and
the theme preview do). It also holds how the background is drawn (`setDrawing`): whether it moves
(when not, it is drawn once for each page, cross-fading from the last, and again on a resize), its
frame rates (idle, while a tint fades, and while something interactive holds
`requestInteracting()`, which returns the release: the map explorer holds it while the map is
dragged or zoomed) and the share of the display's resolution it is drawn at. As a side
effect the tints are on the root element for the interface to use: `--hrs-background-tint`,
`--hrs-background-tint-blend`, and `--hrs-planet-large-tint`, `-medium-` and `-small-` (each with its
`-blend`). The Background page (in the nav) shows it alone, with a back button in the top left
and a Colours button in the top right to try tints: presets, and each part's colour and blend.

The planets are put up in sets: the game's own as the site loads, then one drawn at random with
each page (`nextPlanetSet` on BackgroundStore; the Background page's Planets button too), from the
pool heroes-capture exports beside the scene (`planets/`): the Play screen's three, the tutorial
flyby's three worlds (Azeroth, Korhal, Sanctuary) with their own meshes and lit as the flyby lights
them, and its nine painted spheres on the Play screen's hemisphere, each wearing the Play screen's
hex grid and atmosphere. Each planet loads the first time a set has it (`PlanetLoader`). The
renderer turns each to face the camera as the game's billboards do and lights the flyby's by their
lights (`scene-renderer.ts`); the layout is `planet-sets.ts` (a set from a number, the same number
the same set). A new set is flown to while the background animates: the camera turns, the planets
slide out and the new ones in, the stars streak (1.6 s); where it doesn't, the picture cross-fades.

The Graphics settings (Settings page; `GraphicsStore`, `packages/app/src/app/data/settings/graphics.store.ts`,
kept in `localStorage`: `hrs.graphics.quality` holds the preset's id, or all the quality settings as
JSON when they are Custom; `hrs.graphics.custom` the last custom settings, as JSON; `hrs.graphics`
the look's settings the user chose) set it, through `provideSiteBackground()`: a quality
preset (Low, Medium, High, Ultra, Extreme; until one is chosen it is High, or Low where the
browser draws without hardware acceleration, detected on each load; Custom shows when the values
match none, and is the last such values kept, so choosing it after trying a preset brings them
back; a change that matches no preset replaces them) over the animation, the three frame rates, the resolution and the glass's blur; and the
look, which presets don't touch: the theme (purple or Nexus), the background's colour (fixed, or
random or the next in turn each page; the site always opens untinted and fades to it) and the
glass panels' and the frame's opacity.
The scene comes
from [heroes-capture](https://github.com/myrddraall/heroes-capture) and is checked in under
`packages/app/public/backgrounds/play` (about 1 MB); after a game update, export it again:

```bash
pnpm run generate.play-background   # heroes-capture ui background into packages/app/public/backgrounds/play
```

It needs `heroes-capture` on the path (its release executable, or `pip install -e .` in
heroes-capture's package).

## Releasing

This repository follows the [cpdevtools git-flow](https://github.com/cpdevtools/git-flow-template)
conventions: manifests carry the `0.0.0-MAIN` placeholder and the real version lives in
`.publish/versions.yml`. Packaging the desktop app and publishing the web build are not
wired yet; both are built and tested on every push.
