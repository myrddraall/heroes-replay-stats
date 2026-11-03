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
| Shell applies `data-theme`, the film alphas and blur (CDK overlay container too) | done | `packages/shell/feature/shell` (`shell.ts` host bindings and overlay effect; floors and blurs in `films.ts`); `ShellLook` = theme, opacity, blur |
| Team panels via `data-theme` (`hrsTeam`) | done | `packages/replays/ui/team-theme` |
| Material M3 mapping replaces the overrides in `apps/web/src/styles.scss` | done | the mapping at the end of `nexus.css` (`:root, [data-theme]`, so it wins over `mat.theme` on `html`); `styles.scss` keeps `mat.theme` for type, density and the system tokens the mapping leaves (built-in violet palette). Old `--hrs-*` palette and `.hrs-cta` gone; their users moved to `hrs-team-*`, `hrs-accent`, `hrs-gold`, `hrs-radius-0` |
| Glass bridge: `hrs-glass*` classes and mixins drawn as Nexus films | done | `assets/styles/_glass.scss` + `_glass-mixins.scss`: `.hrs-glass` = film + outside hairline; `--hrs-glass-tint`/`-edge` = each theme's tint/glow as sRGB channels; `.hrs-glass-<variant>` re-tint those; mixins = films and hairlines, no leak |
| Glass files removed (`_glass*.scss`, `_theme-colors.scss`, `glass/`) | todo | when the table below is all done |
| Self theme directive (`green`, the user's own player) | later | no consumer yet |
| Rarity theme directive | later | no consumer yet |
| Game font | later | licence check first; Exo 2 + Source Sans 3 meanwhile |

## Components

Design: **settled** = the user approved it; **changing** = not reviewed yet, may still change.

| Component | Design | Status | Where / notes |
|---|---|---|---|
| TopBar | settled | done | `packages/shell/ui/top-bar` (areas by family, the family break `hrs-nav1__family`, utility cluster projected); the app's logo stands where the game's home logo would |
| SubBar | settled | done | `packages/shell/ui/sub-bar` (level 2 from the nav model; hidden with one section) |
| ShellLayout | settled | done | `packages/shell/feature/shell` (bars over the page, tool Drawer flush right); nav model in `packages/shell/model/nav`, `ShellNavStore`, pages hand over what is open with `showShellItem()` |
| ShellMobile | settled | done | `hrs-shell--handset` from the shell's BreakpointObserver; title + breadcrumb (`packages/shell/ui/crumbs`), nav drawer with the NavTree |
| NavTree | settled | done | `packages/shell/ui/nav-tree` (every level, the current branch open and lit) |
| SideNav | settled | done | `packages/shell/ui/side-nav`, placed by a page as `hrs-shell-side-nav` (`packages/shell/feature/shell-side-nav`); flat sections for now (no groups or sub-items yet) |
| StyledText | settled | done | `packages/common/ui/styled-text` (`hrsStyledText`); the score screen's team results and kill counts |
| ThemeVariants, Rarity | settled | n/a | previews only |
| IconButton | changing | done | the top bar's menu and settings, the tool drawer's toggle; icons 1em of the button (`.hrs-btn .material-symbols-outlined`) |
| Badge | changing | done | CSS in `nexus.css`; the import pod's "+" |
| UtilityPod | changing | done | `packages/import/feature/import-toolbar-action` (button while idle; link + "+" badge + progress bar while importing) |
| Tabs | changing | done | the SubBar's tabs (`hrs-tab`); no in-page tabs yet |
| Drawer | changing | done | the shell's tool drawer (`hrs-drawer--shell`) and handset nav drawer (`hrs-drawer--nav`), Material's drawer colour set to the films |
| SelectionList | changing | done | the SideNav's items |
| Panel | changing | done | CSS in `nexus.css`; settings and theme sections are `hrs-panel` |
| Translucency | changing | done | the films in `nexus.css`, set by the Theme settings through the shell |
| TeamColours | changing | done | `hrs-team-*` tokens; the maps' team dots use them |
| Button | changing | later | |
| ToggleGroup | changing | done | the score cards' rank-by row (`hrs-toggle-group`, `aria-pressed`), sized by font-size |
| Popover | changing | later | |
| Modal | changing | later | |
| Tooltip | changing | later | |
| BackLink | changing | later | |
| Table | changing | done | the replays' stat, score, talent and draft tables: label headers on a hairline, muted cells, faint row lines, hover film, rows themed by team (`data-theme`); dense headers at 0.72em of the table |
| ListRow | changing | done | the match list's team rows (film, half-strength hairline, team theme) |
| KeyValue | changing | later | |
| Card | changing | later | |
| ProductCard | changing | later | |
| Chip | changing | done | the score screen's awards (MVP in gold) |
| ProgressBar | changing | later | |
| Divider | changing | later | |
| SectionHeading | changing | later | |
| Scrollbar | changing | later | |
| Select | changing | later | |
| SearchField | changing | later | |
| TextField | changing | later | |
| Checkbox | changing | later | |
| SlideToggle | changing | later | |
| Slider | changing | later | |
| Portrait | changing | later | |
| StatusBar | changing | later | |

## Glass conversion

Files still using `hrs-glass*` classes or the glass mixins, per package (recounted 2026-11-03 after
the foundation port). A package is done when it uses only Nexus classes and tokens.

| Package | Files | Status |
|---|---|---|
| replays | 0 | done (rows carry `theme`, not a class; Material's `--mat-sys-*` moved to Nexus tokens too) |
| aether-forge | 17 | todo |
| background | 9 | todo |
| maps | 7 | todo |
| shell | 0 | done |
| import | 2 | in progress (the pod) |
| common | 2 | todo |
| players | 2 | todo |
| settings | 0 | done |
| theme | 0 | done |
| sheets | 1 | todo (a doc comment) |
