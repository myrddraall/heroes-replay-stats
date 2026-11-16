---
name: hrs-angular
description: Rules specific to the heroes-replay-stats (HRS) Angular app - page layouts, the HRS Nexus UI theme, the Play background, the map viewer and the editor UI. Use with angular-developer and the angular, angular-signal-store, angular-material and domain-packages conventions skills before planning or writing HRS components, pages, stores or styles.
---

# HRS-specific rules

Layered on `angular-developer` (Angular's defaults) and the `cpdevtools` plugins this repo
enables: `angular:conventions`, `angular-signal-store:conventions`,
`angular-material:conventions`, `domain-packages:conventions`, `cpdevtools-gitflow:release`. Repo: `/devcontainer/repos/heroes-replay-stats`: the app in `apps/web` (only its config
and root routes), everything else in domain packages `packages/<domain>/<layer>` (layers `provide`,
`feature`, `ui`, `data`, `model`, `testing`; Sheriff enforces them, `pnpm run check.boundaries`).
The map viewer is in `packages/maps`, the 3D engine in `packages/aether`.

## Page layout

- Pages sit in **layout container components** (the default is one column). Each child says how
  the width constraint applies to it: `edge-to-edge`, `padded` or `constrained` (max width,
  centred; the default, which the layout can change). The constraint values come through DI (a
  token with a default), never hard-coded.
- No page special cases in the shell's stylesheet (e.g. `.shell__page:has(> hrs-map-page)`).
- Size-dependent styling: **CSS custom properties** (`--hrs-*`) set from bindings or resize
  observers, rather than per-case CSS.

## Theme (HRS Nexus UI): it is Angular Material's theme

- **The app is Angular Material.** The Nexus look reaches it as a Material theme: `mat.theme()` in
  `apps/web/src/styles.scss` (type, density) and the generated
  `packages/common/assets/styles/nexus/_material-theme.scss` (`mat.theme-overrides` and
  `mat.<component>-overrides` on `:root` and every `[data-theme]`). Use Material components
  wherever Material has the thing (buttons, icon buttons, toolbar, tabs, tree, menus, selects,
  sliders, toggles, chips, dialogs, sidenav), and style components with Material's
  `--mat-sys-*` tokens. Never swap Material tokens or components for the theme's own `--hrs-*`
  tokens or `.hrs-*` classes.
- `.hrs-*` classes (nexus.css) only where Material has no component: panel (`hrs-panel`), the
  shell bars' look (top bar, sub-bar, side nav, tree rows), the import pod, badges, StyledText
  (`hrsStyledText`). Each component's README in `packages/common/design-system/components` names
  its Material component in its "Material" line: follow it.
- One source: `tokens.json` + `components/bundle.css` (its last block is the Material mapping).
  `pnpm run generate.theme` writes `tokens.css`, `nexus.css` and `_material-theme.scss`; never
  edit them. Builders are TypeScript (`generate.design-system`, `generate.design-system-previews`,
  `check.contrast`); never add another language.
- Themes are `data-theme` on any element (nestable; Material re-themes inside it): the shell
  carries the user's neutral (purple/magenta/cyan, `ThemeStore`), `hrsTeam` sets `blue`/`red`.
- The films: the shell sets `--hrs-surface-alpha`(-raised/-modal) from the Opacity setting and
  `--hrs-backdrop*` (blur) on its host and the CDK overlay container.
- The glass theme is gone (2026-11-03): no `.hrs-glass*`, glass mixins or `--hrs-glass-*`. Panels are
  `.hrs-panel`, colours Material's `--mat-sys-*` tokens.
- Handset form is the shell's `hrs-shell--handset` class (BreakpointObserver), never a media query.
- Game textures come from heroes-assets interface sheets through `SheetStore`/`SHEET_PICTURES`.

## Navigation (shell)

- Agreed structure in the design system README's "Navigation": level 1 REPLAYS · GAME INFO · ABOUT,
  level 2 the area's sections (SubBar; Replays: Matches · Players · Maps (disabled) · Import), level 3
  the SideNav of what is open (a match's sections, Stats' as sub-items); Settings and the Dev pages are
  in the settings menu; the import pod also leads to Replays › Import.
- Navigation is data: `provideShellArea` (path, label, order), `provideShellSection` (an
  area's fixed sections; `disabled` for one still to be built), `provideShellMenuItem` (settings menu, `group: 'dev'`) from
  `@…/shell/ui`. A page with something open (a match, a map) calls `showShellItem(() => item)`
  (`@…/shell/feature`), with its sections when it has them (its SideNav); that page places
  `<hrs-shell-side-nav />` in its own layout. Never templates handed to the shell.
- Handset is the shell's `hrs-shell--handset` (BreakpointObserver), never a media query.

## Play background

- Always on, one instance in the shell, on every page. Any pause or hide goes through a root
  service or store that the shell's background reads, never per-page logic.
- Drawn by three.js (`WebGPURenderer`, TSL node materials; `packages/aether/src/render/`), on
  WebGPU or its WebGL 2 backend as Settings → Graphics API chooses (`RENDER_API`, from aether's
  `GraphicsSettingsStore`; the Automatic rule lives there). HRS reaches aether only through the
  `background` domain (and `dev`'s tools). Assets exported from the game by heroes-capture `ui background`.
- Shaders: one program per kind of draw (body part, sky mesh, each pass), features as uniform
  data and branches, never a shader per feature combination; a new planet set or an edit compiles
  nothing. Draws share one material per kind/blend/depth and carry their own values (`DrawValues`).
- Check speed and parity with `/renderer-check` (WebGPU vs WebGL 2, cold compiles); it reports to
  the dev server (`pnpm run serve.reports` → `tmp/dev-reports/`), so results never need pasting.

## Map viewer (`packages/maps`)

- `hrs-map-viewer` is presentational: it takes the pack and draws the pack's own layers.
  A smart component takes the map id, loads, and handles the viewer's events.
- Extra layers are directives placed as children of the viewer. Layer order, depth and parallax
  are data-driven (the pack's order and `rate`), and custom layers use the same mechanism.
- Camera: never show the sky layers' edges; zoom always allows the whole playable area with a
  margin; letterbox/pillarbox bars only as thick as needed, styleable via custom properties.
- No toolbars or control UI unless asked.
- `MAP_PACKS_URL` comes from the environment (`provideMapsFeature({ packsUrl })`); local renders use the `local` configuration,
  never a hard-coded URL.

## Editor UI (Background editor and similar panels)

- Plain nouns for headings and list titles ("Moons", "Lights"), never "Its moons" or "Added".
- Words: "design" means author-time content only (what is set up and saved), never runtime
  selection or loading; say "saved data", not "document" (read as documentation).
- No hint text about implementation, storage or export status.
- Controls that don't apply are hidden, not disabled.
- Resets sit in a fixed column at the right end of each row and section heading.
- Wherever things are added: one pod holds the add controls plus a nested list of what was
  added, each row with a select link and delete where removable.
- Library and editor are separate URLs; nested routes keep the page mounted.

## Check it

`pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest) from the root, then look at it in the
running app (the `hrs-run` skill).

HRS deploys to GitHub Pages on every push to `main` (`pages.yml`) for now.
