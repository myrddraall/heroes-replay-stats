# Heroes Replay Stats

Statistics from your Heroes of the Storm replays — an Angular app that runs in the
browser and, through a thin Electron shell, on the desktop. Everything happens on your
device: replays are parsed locally and stored in IndexedDB; there is no account, no
login and no server.

| Package                                                         | What it is                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@myrddraall/heroes-replay-stats`](./packages/app)             | the Angular 22 + Material app, themed after the game                  |
| [`@myrddraall/heroes-replay-stats-desktop`](./packages/desktop) | the Electron shell: a window, and a preload bridge for the filesystem |

The replay parsing, the model and the analysers come from
[myrddraall/heroprotocol](https://github.com/myrddraall/heroprotocol).

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
