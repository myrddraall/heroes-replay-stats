# Porting HRS Nexus UI into the app

What has been brought into the app from this design system, and what is left. Update a row in the
same change that ports it. The spec is the README and `components/` in this folder (published as
the "HRS Nexus UI" Design System artifact).

Status values: **todo**, **in progress**, **done** (with where it lives), **later** (not needed yet:
port it when a page needs it).

## Foundation

| Piece | Status | Where / notes |
|---|---|---|
| Generated stylesheet in `packages/common/assets/styles` (tokens + bundle, one source here) | done | `assets/styles/nexus/tokens.css` + `nexus.css`, written by `pnpm run generate.theme` (`packages/common/tools/generate-theme.ts`), loaded before `styles.scss` in `apps/web/angular.json`. Type styles become `--hrs-font-<style>` / `--hrs-tracking-<style>` properties (not classes); the preview helpers and the font `@import` are left out; the embedded textures become `var(--hrs-tex-<texture>)` |
| Header textures as sheet entries (heroes-assets `ui-sheets`), not data URIs | done | heroes-assets `ui-sheets/navigation.json` (9 pictures), published in release 2.57.9834810 (`live/ui/navigation.webp` on Pages); the shell sets `--hrs-tex-*` from it through `SHEET_PICTURES` (`packages/shell/data/navigation-textures.ts`; the vertical underline is `hover-underline` cut with `rotate: 90`) |
| ThemeSettings model, store and form (README "Settings") | done | `packages/theme` (model `NeutralTheme`, `ThemeName`, `validTheme` with the glass carry-over; `ThemeStore`; `ThemeForm`: Colour, Opacity, blur) |
| Shell applies `theme`, the film alphas and blur (CDK overlay container too) | done | `packages/shell/feature/shell` (`shell.ts` host bindings and overlay effect; floors and blurs in `films.ts`); `ShellLook` = theme, opacity, blur |
| Team panels via `theme` (`hrsTeam`) | done | `packages/replays/ui/team-theme` |
| Material M3 mapping replaces the overrides in `apps/web/src/styles.scss` | done | as a Material theme: `assets/styles/nexus/_material-theme.scss`, generated from bundle.css's mapping (`mat.theme-overrides` + `mat.<component>-overrides` on `:root` and every `[theme]`), `@use`d by `styles.scss` after `mat.theme` (type, density). Components keep Material's components and `--mat-sys-*` tokens |
| Glass bridge: `hrs-glass*` classes and mixins drawn as Nexus films | removed | served until every package was converted, then deleted with the files below |
| Glass files removed (`_glass*.scss`, `_theme-colors.scss`, `glass/`) | done | 2026-11-03; the background editor's `panelClass` option went with them (the editor sits in the shell, which carries `theme`) |
| Self theme directive (`self`, the user's own player) | later | no consumer yet |
| Rarity theme directive | later | no consumer yet |
| Game font | later | licence check first; Saira + Source Sans 3 meanwhile |

## Components

Design: **settled** = the user approved it; **changing** = not reviewed yet, may still change.

| Component | Design | Status | Where / notes |
|---|---|---|---|
| TopBar | settled | done | `packages/shell/ui/top-bar`: a `mat-toolbar` (toolbar overrides: transparent, bar height) over the bar's textures; `mat-icon-button`s |
| SubBar | settled | done | `packages/shell/ui/sub-bar`: `mat-tab-nav-bar` + `mat-tab-link` controlling the shell's `mat-tab-nav-panel` around the page (Material 22 requires one; the current tab is `aria-selected`); `mat.tabs-overrides` for the type, transparent label colours (the theme's gradients show) and the indicator hidden; bundle.css adapts the theme's tab to Material's markup (label in flow for the text clip, separator on the content box since the focus indicator owns `::before`, no 90px minimum or flex gap) |
| ShellLayout | settled | done | `packages/shell/feature/shell` (bars over the page, tool Drawer flush right); nav model in `packages/shell/model/nav`, `ShellNavStore`, pages hand over what is open with `showShellItem()` |
| ShellMobile | settled | done | `hrs-shell--handset` from the shell's BreakpointObserver; title + breadcrumb (`packages/shell/ui/crumbs`), nav drawer with the NavTree |
| NavTree | settled | done | `packages/shell/ui/nav-tree`: `mat-tree` with nested nodes (`isExpanded` from the active branch, Enter follows the link), links as `.hrs-tree__item`, the chevron only on rows with children |
| SideNav | settled | done | `packages/shell/ui/side-nav`, placed by a page as `hrs-shell-side-nav` (`packages/shell/feature/shell-side-nav`); one folding group (`hrs-sidenav__heading`) headed by what is open (a match), its sections with their sub-items (Stats') |
| StyledText | settled | done | `packages/common/ui/styled-text` (`hrsStyledText`); no page uses it yet |
| ThemeVariants, Rarity | settled | n/a | previews only |
| IconButton | changing | done | `mat-icon-button` with icon-button overrides (square, 36px, 16px icon, no state layer) and the outline ring in nexus.css; a `mat-icon` takes the icon-size token; in a Drawer header it is the small one (0.78) |
| Badge | changing | done | CSS in `nexus.css`; the import pod's "+" |
| UtilityPod | changing | done | `packages/import/feature/import-toolbar-action` (button while idle; link + "+" badge + progress bar while importing) |
| Tabs | changing | done | the SubBar's tabs (`hrs-tab`); no in-page tabs yet |
| Drawer | changing | done | the shell's tool drawer (`hrs-drawer--shell`) and handset nav drawer (`hrs-drawer--nav`), Material's drawer colour set to the films; the side panel (`ui-side-panel`) uses the Drawer header |
| SelectionList | changing | done | the SideNav's items |
| Panel | changing | done | CSS in `nexus.css`; settings and theme sections are `hrs-panel` |
| Translucency | changing | done | the films in `nexus.css`, set by the Theme settings through the shell |
| TeamColours | changing | done | `hrs-team-*` tokens; the maps' team dots use them |
| Button | changing | later | |
| ToggleGroup | changing | later | |
| Popover | changing | later | |
| Modal | changing | later | |
| Tooltip | changing | later | |
| BackLink | changing | later | |
| DataGrid | new | done | `hrs-data-grid` in `packages/data-views` (TanStack Virtual, page scroll, look by custom properties, Material sort): score, stat tables (team stats, player stats, unit kills, XP), talents, draft, players |
| ItemList | new | done | `hrs-item-list` in `packages/data-views`: matches, maps, points of interest, chat; Dev › UI › Tests › Lists |
| ListRow | changing | later | |
| KeyValue | changing | later | |
| Card | changing | later | |
| ProductCard | changing | later | |
| Chip | changing | later | |
| ProgressBar | changing | later | |
| Divider | changing | later | |
| SectionHeading | changing | later | |
| Scrollbar | changing | done | every scrolling area, Material's included: the `::-webkit-scrollbar` parts in nexus.css, built from the game's Storm_ScrollBar_Background and Storm_ScrollBar_Button |
| Select | changing | later | |
| SearchField | changing | later | |
| TextField | changing | later | |
| Checkbox | changing | later | |
| SlideToggle | changing | later | |
| Slider | changing | later | |
| Portrait | changing | later | |
| StatusBar | changing | later | |

## Glass conversion

Files that used `hrs-glass*` classes or the glass mixins, per package (counted 2026-11-03 after the
foundation port; all converted the same day). A package is done when it has no glass left: Material components and
`--mat-sys-*` tokens, `.hrs-*` classes only for what Material has no component for.

| Package | Files | Status |
|---|---|---|
| replays | 0 | done (glass gone: `.hrs-panel` for its panels, team rows by `theme`; its styles stay on Material's `--mat-sys-*` tokens) |
| aether-forge | 17 | done (Material drawers with a hairline, fields and flyouts on `--mat-sys-surface-container*`, accents on `--mat-sys-primary`, markers from `--mat-sys-secondary`/`-primary`) |
| background | 9 | done (Theme preview, Dev › UI › Theme: a panel per `theme`, its opacity and blur the site's) |
| maps | 7 | done (Material drawers, `.hrs-panel` map cards, lines `--mat-sys-outline-variant`) |
| shell | 0 | done |
| import | 2 | done |
| common | 2 | done |
| players | 2 | done |
| settings | 0 | done |
| theme | 0 | done |
| sheets | 1 | done (a doc comment) |
