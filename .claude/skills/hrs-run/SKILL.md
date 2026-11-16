---
name: hrs-run
description: Launch heroes-replay-stats (HRS) in the devcontainer, with local map renders, and check a change in the browser with Playwright screenshots. Use when asked to run, start, preview or screenshot the HRS app, to show a new map render in it, or to confirm an HRS change works in the real app.
---

# Run HRS and look at it

Repo: `/devcontainer/repos/heroes-replay-stats` (pnpm workspace; the app is `apps/web`, the rest
domain packages in `packages/`).

## Start

From the repo root, as background commands:

```bash
pnpm run serve.maps   # maps server on :4208, serving ../heroes-capture/tmp/results/maps
pnpm start            # Angular dev server on http://localhost:4200
```

- `DEV_LOCAL=true` in the devcontainer makes `apps/web/tools/ng.mts` add the `local`
  configuration (`development,local` / `production,local`): the app reads maps from `/maps-local/`,
  which the dev server proxies to :4208. Only port 4200 needs forwarding.
- `pnpm run serve.maps <folder> [port]` serves another folder of renders. New renders show on
  the next reload.
- Interface sheets built on this machine: `pnpm run serve.sheets [folder] [port]` (:4210,
  proxied as `/ui-sheets-local/`); without it the sheets come from heroes-assets.
- Extra `ng serve` flags go straight after the script (pnpm 11 rejects `--`):
  `pnpm start --port 4300` for a second checkout or worktree.
- `pnpm start --configuration production` serves the production bundle the same way.
- **Never** hard-code a temporary `MAP_PACKS_URL` or edit `app.config.ts`/environment files for a
  preview: use the `local` configuration.
- Sample replays to import: the repo's `tmp/*.StormReplay`.
- If a dev server is already running (check `ss -ltnp | grep -E ':4200|:4208'`), reuse it. Always
  :4200: never start a second server on another port (no `--port 4300`, no scratch proxy), even
  when the running one looks stale. If it is down, start it on :4200 and leave it running.

## Memory

The container already uses a lot at idle (VS Code server, sync service, ng serve, MCP servers).
Check `cat /sys/fs/cgroup/memory.current` before starting a browser. Run one heavy thing at a time:
no game-data exports, heroes-capture tests or torch searches while a browser is open.
**Close the Playwright browser** when the captures are done.

## Look at it

- Use the `playwright` MCP server (headless Chromium inside the container) for
  `http://localhost:4200/...`. `playwright-shared` drives the user's own Chrome on Windows over
  CDP: use it only when the user asks to see something in their browser.
- The Playwright MCP browser hides scrollbars in screenshots. To check a scrollbar, launch Chromium with
  playwright-core and `ignoreDefaultArgs: ['--hide-scrollbars']` and screenshot that.
- Headless Chromium has software WebGL (SwiftShader), so the Play background defaults to the Low
  graphics preset and animates slowly. Judge layout and colours, not frame rate.
- "Side by side" means against the game itself: reference shots are in
  `/devcontainer/repos/heroesbrowser-replay-viewer/.playwright-mcp/` (`game-quick-match.jpeg`,
  `game-quick-match-hero.jpeg`, `game-large-rim-closeup.png`, `ref-*.png`).

## Showing pictures to the user

- Save every screenshot in `/devcontainer/repos/heroesbrowser-replay-viewer/.playwright-mcp/`
  (git-ignored) and give it as a clickable relative link, e.g.
  `[map page](.playwright-mcp/map-page.png)`. Never a bare or scratchpad path.
- Before handing over, open each picture and check it at its displayed size: resolution,
  scaling, nothing stale. Never upscale. When republishing over the same names, say which are
  new.
- Don't delete linked pictures during cleanup until the user is done with them.

## Checks before saying it works

`pnpm typecheck`, `pnpm lint` and `pnpm test` from the root (or `--filter` for one package),
plus the screenshot of the actual page. Report failures with their output.

## Deploy (for reference)

A push to `main` deploys the app to GitHub Pages (`pages.yml`); check `gh run list` for the Pages
run. heroes-maps' Pages caches `pack.json` for 10 minutes, so a browser that loaded the app within
that window can show an old pack. Pushes are the user's call.
