# Heroes Replay Stats — desktop shell

Electron around the shared Angular app. Nothing app-specific lives here: the main
process opens a window, the preload exposes `window.heroesDesktop` (file picking and the
game's replay folder), and the app's `providePlatform()` switches to the desktop platform
when it sees it.

```bash
pnpm start                 # the Angular dev server on :4200 (from the workspace root)
pnpm desktop               # build main+preload and open Electron against the dev server
```

Packaging (`electron-builder`) copies the built app into `./app`; wired when the app has
something worth shipping.
