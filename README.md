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

## Releasing

This repository follows the [cpdevtools git-flow](https://github.com/cpdevtools/git-flow-template)
conventions: manifests carry the `0.0.0-MAIN` placeholder and the real version lives in
`.publish/versions.yml`. Packaging the desktop app and publishing the web build are not
wired yet; both are built and tested on every push.
