# Drawer
A side panel for tools and secondary content: the right tool drawer (column picker, presets) and, on handset, the level-1 navigation. Raised film, one hairline on its page-facing side, shade.
- Header row: `panel-title` uppercase, Close at the right end; optional pinned area under it; the body scrolls (`.hrs-scroll`).
- Shell panels (`hrs-drawer--shell`, `hrs-drawer--nav`) go to the edges: full height from under the bars to the bottom, flush against the window side, one hairline on the page-facing side only, no radius, no margin. Desktop: beside the content at `--hrs-side-panel`. Handset: over the content, `min(320px, 86vw)`.
**Consumer provides:** title, pinned area, body. **Material:** `mat-drawer`/`mat-sidenav` with `--mat-sidenav-container-background-color: var(--hrs-film-raised)` and shape 0.
