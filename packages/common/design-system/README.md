The Heroes of the Storm menus, rebuilt as a web UI for heroes-replay-stats (HRS): dark translucent films over the animated Play scene, square panels with one violet hairline, glow for state, uppercase tracked chrome. Built for a good web app first; the game's screens are the reference, not the target. Mostly CSS; a game texture only where the thing plainly is one (portrait frames, hex ability frames, icons).

## Building

Written by hand: `components/bundle.css` (apart from its rarity block) and each component's `README.md` and `preview.html`. Generated, TypeScript in `build/`, run from the repository root:

- `pnpm run generate.design-system`: `tokens.json` (from `build/tokens.ts` and the role table in `build/themes.ts`) and the rarity block of `bundle.css`.
- `pnpm run generate.design-system-previews`: the previews as pages in `tmp/design-system-harness`.
- `pnpm run check.contrast`: every text, line and focus colour against its surfaces, in every theme.
- `pnpm run generate.theme`: the app's copy in `packages/common/assets/styles/nexus`.

## Principles

- **Films, not cards.** Every surface is `hrs-tint` at `hrs-surface-alpha` over the scene; raised things (popovers, menus, drawers, the top bar) use `hrs-tint-raised` at `hrs-surface-alpha-raised`; dialogs `hrs-surface-alpha-modal`. These alphas are the legibility floor: one Opacity setting raises every film together from them towards solid, never below (see Settings). Backdrop blur (`hrs-backdrop*`) is a setting, off by default.
- **Square.** `hrs-radius-0` on panels, buttons, fields, cards, modals, tabs. `hrs-radius-1` (2px) only on badges, chips and the slider thumb.
- **One hairline, glow for state.** Rest: 1px `hrs-border`. Hover: `hrs-border-strong` + `hrs-glow-hover`. Selected / current / focused / primary: `hrs-border-strong` + `hrs-glow-selected` (+ `hrs-selection` fill where there is a fill). Floating: `hrs-glow-panel` + `hrs-shade`. Glows are outer only; no inset light, no gradients except the faint button face.
- **Text.** `hrs-text` for titles, names, values and labels of controls; `hrs-text-muted` for body, labels, column headers, placeholders; `hrs-text-dim` only for disabled and empty-slot text. Uppercase with tracking (`nav-1`, `label`, `display`, `panel-title`) is for chrome and headings, never for body copy. Content section headings carry the chevron (`section`). The game's display treatments (team-coloured, bright with a halo, gradient-filled with a glow) are the StyledText classes `hrs-styled--base|bright|glow`, themed by `data-theme`; a few words or numbers per view, never body copy.
- **Colour means something.** `hrs-team-blue` / `hrs-team-red` for players by team, `hrs-self` for the user's own player, `hrs-gold` for ownership, MVP and heroic marks, `hrs-error` / `hrs-info` / `hrs-warning` for lines that say so in words too. These never change with the theme.
- **Focus.** Keyboard focus is the `hrs-focus` outline (2px, 2px offset) on every control in every theme; fields also light their selected glow.
- **Sized by font-size.** Pictorial components are built around 1em: the glyph, initials or icon is 1em and the frame, border, glow and plate are em multiples of it, so `font-size` is the one size control and a component scales as a whole (StyledText, Portrait, IconButton and `hrs-icon`, Badge, Chip, ToggleGroup, the item frame, the pod icon). No px size modifiers on these; a modifier may only set a font-size. Form controls and bars keep the `hrs-control*` and `hrs-bar-*` heights so fields and buttons line up.
- **No padding for its own sake.** Spacing is the `hrs-space-*` scale; controls are `hrs-control` (36px) and `hrs-control-sm` (28px) tall.

## Voice

Plain English, sentence case ("Watch solo", "Import replays") except the two nav levels, which keep the game's casing (level 1 uppercase, level 2 title case: "Quick Match"); nouns for headings ("Moons", "Columns"), no hint text about storage or status, no exclamation marks, no emoji. Numbers are tabular (`numeric`).

## Colour system: OKLCH

Every colour token is written in `oklch()`. The per-theme roles (ground, tint, tint-raised, selection, border, border-strong, accent, glow, text-muted, text-dim, on-accent) share one lightness and chroma across all twelve themes and differ only in hue (purple 286, magenta 328, cyan 230, blue 266, red 18, green 158; poor and common 0 chroma, uncommon 142 (WoW #1eff00, with a vivid accent, border and glow), rare 250 (WoW #0070dd, deep and saturated), epic 306 (WoW #a335ee, vivid orchid), legendary 53 (WoW #ff8000)), so no theme reads brighter or louder than another: a red glow and a blue glow carry the same weight. The glow role takes each hue's chroma at the sRGB gamut edge. Semantic tokens keep their exact source colours, converted to OKLCH. The stylesheet composes in OKLab too: films and halos are `oklch(from …)` relative colours with the alpha tokens, and every gradient interpolates `in oklab`, so a white-to-accent fill passes through no grey. Contrast is checked on the sRGB result of each value.

## Themes

Twelve themes, one mechanism: `data-theme` on any element re-tints everything inside it, and themes nest freely (a red roster panel inside a purple page, an epic card inside a blue panel). A theme changes surfaces, borders, accents and glows; it never changes the semantic colours.

- **Base themes** (in tokens.json): `purple` (neutral, the game's menus; the default), `magenta` (a neutral on the game's ColorPurple #f600ff), `cyan` (the third neutral), `blue` (blue team), `red` (red team), `green` (the user's own player). The shell carries the neutral theme the user picks; a team panel carries its team; a "you" panel carries green.
- **Rarity themes** (declared in `components/bundle.css` from the same role table, because the tokens page holds at most eight themes): `poor` grey, `common` white, `uncommon` green, `rare` blue, `epic` purple, `legendary` orange, on the WoW item-quality hues. For items, loot and talent tiers: a Card, Chip, StyledText, frame or whole panel. Their glow strength climbs with the tier (`--hrs-glow-k` 0.35 → 1.15); poor and common carry no chroma: poor is WoW's dim grey (#9d9d9d) with almost no glow, common its bright white (#ffffff), labels included. Every coloured tier sits on its WoW item-quality colour and is more saturated than the base themes, which is how a tier stays apart from its neighbour: epic (306, a vivid orchid) beside purple (286, a soft violet), rare (250, a deep azure, darker than blue team's pale periwinkle at 266), uncommon (142, vivid yellow-green) beside green (158, a softer emerald): the Rarity preview shows each inside its neighbour.

## Settings

The theme's settings live in the Theme settings section (Settings → Theme: the `theme` domain's ThemeStore, saved on the device under `hrs.theme`), not in Graphics.

```ts
interface ThemeSettings {
  theme: 'purple' | 'magenta' | 'cyan'; // the neutral the site wears; default 'purple'
  opacity: number; // 0..1, one slider for every film; default 0
  blur: boolean; // backdrop blur behind the films; default false
}
```

- **theme** is the shell's `data-theme`. Only the three neutrals are a choice.
- **opacity** moves all films together from their floor (0) to solid (1): alpha = floor + opacity × (1 − floor), with the floors `hrs-surface-alpha` 0.72, `hrs-surface-alpha-raised` 0.92 and `hrs-surface-alpha-modal` 0.9. No film goes below its floor, blur or not.
- **blur** on sets `hrs-backdrop`, `hrs-backdrop-raised` and `hrs-backdrop-modal` to their blur tokens; off, they are `none`.
- **Not settings:** `blue`, `red`, `green` and the six rarity themes come from the data, set by directives (a team panel, the user's own player, an item's tier).
- **Saved values from the glass theme:** `neutral` becomes `purple` and `nexus` becomes `cyan`; the old glass and frame alphas are dropped (opacity starts at 0); blur is kept. Nothing is read from the older Graphics keys.

## Type

The game's face is **Metronic for Blizzard** (`UI/Fonts/MetronicforBlizzard-Bold.otf` and `MetronicforBlizzard.otf`, the FontHeader / FontStandard constants of core `ui/fontstyles.stormstyle`): a custom cut of Mostardesign's Metronic Pro licensed to Blizzard, so not free to serve. Interim stack: `brand` = Exo 2 for chrome and headings (`nav-1`, `nav-2`, `nav-3`, `label`, `display`, `title`, `section`, `panel-title`), `plain` = Source Sans 3 for text (`body`, `body-strong`, `small`, `caption`, `numeric`), `mono` for file names. Both hosted (Google Fonts); no files in `fonts/`. To use Metronic on the site, buy a web licence for Metronic Pro from its foundry; the game's files cannot be served. Otherwise an open look-alike stays the brand face.

## Shell layout

Three navigation levels, then the page:

1. **TopBar** (level 1, `hrs-bar-1` 52px): brand mark, the areas (see Navigation) with dividers and count badges where something needs attention, then the utility cluster: the import UtilityPod (count, progress bar while importing, "+" corner badge to import more), and a settings IconButton (whose menu holds Settings and the Dev pages). No account portrait: HRS has no profile or login. The bar is built as the game's TopNavContainer in `standardtemplates.stormlayout`: the triangle mask tiled across the whole bar with a shimmer glow scrolling through it on an 8 s loop; the selected button's glow pulse (4 s), underline and rising sparkle triangles, with the label styles from `fontstyles.stormstyle` (TaskBarNavigation / TaskBarSubNavigation). Every colour comes from the theme's accent, text and glow tokens, so it follows `data-theme`.
2. **SubBar** (level 2, `hrs-bar-2` 30px): the second horizontal nav, directly under the first: the sections of the current area as a scrolling tab row on the game's darker band, the selected one underlined with a glow; where the page has no sections (About, Settings) it slides up behind the TopBar and hides, and slides back down with the next page that has them.
3. **SideNav** (level 3, `hrs-side-nav` 240px): the page's categories / filters / presets as a SelectionList in a column at the left of the content, inside the page's own layout (constrained / padded / edge-to-edge as today).
4. **Content** in Panels; the right **Drawer** (`hrs-side-panel` 320px) for tools such as the column picker. An optional **StatusBar** on the desktop shell.

**Handset:** no horizontal navs. The shell sets `hrs-shell--handset` from its breakpoint signal (never a viewport media query). The TopBar holds the menu button, the current area's title in the selected nav look, and settings; the SubBar band holds a breadcrumb (area › page › section); every level of navigation, the page's categories included, is one NavTree in the nav Drawer that opens from the left over the page. The tool Drawer still opens from the right over the content.

## Navigation

Replays are how HRS gets match data; the site is organised around what the replays tell, the game itself, and the app. Level 1 holds three areas, the game's separator between each:

**REPLAYS · GAME INFO · ABOUT**

| Area | Level 2 (SubBar) | Inside an item: its SideNav (level 3) |
|---|---|---|
| Replays | Matches · Players · Maps (disabled until built) · Import | a match: Score, Teams, Draft, Talents, Chat, Stats (its stat sections as sub-items), Unit Kills, XP; the SubBar stays on Matches |
| Game Info | Maps · Heroes (disabled until built) | a map: none yet |
| About | — | — |

- A section still to be built shows disabled (dim, not a link) on the SubBar and in the NavTree.
- Import is Replays' last section; the UtilityPod in the TopBar leads to it as well.
- The settings menu: Settings, then a Dev group (Theme preview, Background, Renderer check and future test pages). Dev has no place on the bars.
- The SubBar slides up behind the TopBar and hides where there are no sections (About, Settings). Breadcrumbs follow the same path: Replays › Matches › Blackheart's Bay › Stats › PvP; Game Info › Maps › Cursed Hollow.
- Routes follow the areas: `/replays/matches/:id/…`, `/replays/players`, `/replays/import`, `/game-info/maps/:id`, `/about`. Older URLs redirect (`/matches/…`, `/players`, `/import`, `/game/maps/…`, `/maps/…`, `/replays/:id/…`).
- Navigation is data, not templates: each area is declared with its order; fixed sections come with the area (from the domains whose pages they open); a page whose sections depend on what is open (a match) hands the shell its SideNav as data. The TopBar and SubBar, the page's SideNav and the handset NavTree all draw from that one model.

## Components

Shell: TopBar, SubBar, SideNav, UtilityPod, Portrait, StatusBar, ShellLayout, ShellMobile. Surfaces: Panel, Popover, Modal, Tooltip, Drawer, Divider. Actions: Button, IconButton, ToggleGroup, SelectionList, Tabs, BackLink, SectionHeading. Data: DataGrid, ItemList, Table, ListRow, Card, ProductCard, Badge, Chip, ProgressBar, KeyValue, Scrollbar. Inputs: Select, SearchField, TextField, Checkbox, SlideToggle, Slider. Colour: ThemeVariants (all twelve), Rarity, TeamColours, Translucency, StyledText (the game's gradient and glow text treatments, per theme).

Each component's README says what the consumer provides, its states, and the Angular Material mapping. Every preview is plain HTML on `components/bundle.css`; that stylesheet is the theme and ports to `packages/ui/src/theme` as is.

## Angular Material mapping

`bundle.css` ends with the M3 system tokens realised from HRS tokens (`--mat-sys-surface*` → the films, `--mat-sys-outline*` → `hrs-border`, `--mat-sys-primary` → `hrs-accent`, every `--mat-sys-corner-*` → 0 except extra-small and full → 2px, elevation levels → `hrs-shade`) plus per-component overrides (menu, select, dialog, sidenav, tooltip, tabs, form field, buttons, slider, checkbox, slide toggle, progress bar, table, chips, list, button toggle). In the app these go through `mat.theme()` for the base and `mat.<component>-overrides()` for the rest; the `.hrs-*` classes cover what Material has no component for (panel, selection list, badge, pod, player portrait, rows, cards, dividers, section headings).

## Iconography

Material Symbols (outlined) at 1em of their control (16px in buttons and fields, 20px in nav), in `currentColor`; the previews stand them in with glyphs. Game icons (roles, currencies, sort arrows, the close ×) are extracted assets, listed below.

## Game assets (to extract through heroes-assets `ui-sheets`)

Obviously game art, used as 9-slice frames or sprites: the main navigation set (`storm_ui_mainnavigation_background`, `_subbackground`, `storm_ui_triangle_mask`, `storm_ui_mainnavigation_shimmer`, `_hover` (the glow blob), `_hover_underline`, `_hover_particle` (the sparkle triangle), `_separator`, `_separator_sub`, `_home_logo`), now used directly by TopBar and SubBar (embedded in the stylesheet, recoloured per theme), and the dialogs' triangle flash (`storm_ui_season_roll_triangle`, `storm_ui_profiledialog_bordertriangleglow`); portrait frames (`storm_ui_profiledialog_portraitframe`, `storm_ui_profiledialog_portraitborder`, the `storm_ui_portrait_border_*` rank set), the hex ability frame (`storm_ui_ingame_abilitybuttonborder`, `hud_btn_bg_ability`), role and replay icons (`storm_ui_glues_replaypanel_icon_replay`, `_icon_folder`, `_icon_sortarrow`, `_icon_sortarrow_up`, `storm_ui_icon_searchglass`), the close button (`storm_ui_glues_button_close`).

CSS first; swap to the asset only if CSS cannot match: panel border (`storm_ui_glues_standard_smallpanel_border`, `_pointer`), top-nav and sub-nav highlights (`storm_ui_glues_button_topnav`, `storm_ui_glues_button_subnav_highlight`, `storm_ui_mainnavigation_hover_underline`, `storm_ui_mainnavigation_separator`), left-nav button (`storm_ui_leftnav_button`), dropdown (`storm_standarddropdown`, `_blue_arrow`), checkbox (`storm_ui_glues_checkbox`, `storm_ui_glues_checkboxmark`), scrollbar (`storm_scrollbar_background`, `storm_scrollbar_button`), slider (`storm_standardslider`, `_button`), dialog glow (`storm_ui_profiledialog_borderglow`, `_bordertriangleglow`), the modal pattern.
