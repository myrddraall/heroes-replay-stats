# DataGrid
Every table of data: stat tables, the score table, talents, the draft, unit kills, XP, team stats, players. One component, `hrs-data-grid`; what differs between tables is only how each page styles it.
- **Columns** are declared as children: `<hrs-column name="kills" header="Kills" width="6ch" align="end" sortable />`, with optional `hrsCell` and `hrsHeader` templates for anything beyond plain text. Columns can come from data (the stat tables' column picker). `width` is any grid track (`6ch`, `minmax(12em, 2fr)`).
- **Rows** come from `items` (an array, or a data source that loads ranges; rows not loaded yet show placeholders). Optional: `trackBy`, `[(sort)]` (headers carry `aria-sort`; Material's `matSort` drives it), `[(selected)]` (one row, `aria-selected`, only where selecting does something), `groupBy` (group rows, such as the two teams), `(activate)`.
- **Only what is on screen is drawn.** The grid never scrolls up and down itself: it sits in the page at its full height and draws the rows inside the page's view, so any number of grids and lists can share a page. A grid wider than its space scrolls sideways inside itself; its header row stays at the top of the view while its rows pass under it, and its first column stays put while it scrolls sideways.
- **Built as a CSS grid with table roles** (`table`, `rowgroup`, `row`, `columnheader`, `cell`, `aria-rowcount`/`aria-rowindex`), so column widths hold while rows are reused. Coming back to a page returns it to where it was.
- **The look is the page's**, through these custom properties on the element (defaults below):

| Property | Default | |
|---|---|---|
| `--hrs-grid-row-height` | `40px` | a row's height (dense tables: `28px`) |
| `--hrs-grid-row-gap` | `0` | space between rows (separated rows, as the score table) |
| `--hrs-grid-cell-padding` | `0 12px` | |
| `--hrs-grid-font` | `400 13px/18px` plain | cells |
| `--hrs-grid-text` | `hrs-text-muted` | cells; the first column takes `--hrs-grid-first-text` (`hrs-text`) |
| `--hrs-grid-header-height` | `32px` | |
| `--hrs-grid-header-font` | the `label` style | uppercase header labels |
| `--hrs-grid-header-text` | `hrs-text-muted` | sorted header: `hrs-text` |
| `--hrs-grid-row-background` | `transparent` | each row's fill |
| `--hrs-grid-row-line` | a 35% hairline | the line under each row (`none` with separated rows) |
| `--hrs-grid-row-hover` | `hrs-film-hover` | |
| `--hrs-grid-row-selected` | `hrs-selection` | with an inset strong ring |
| `--hrs-grid-sticky-background` | `hrs-film-raised` | the first column while scrolling sideways |

**Parts** (theme classes): `.hrs-grid__head`, `.hrs-grid__body`, `.hrs-grid__row`, `.hrs-grid__header`, `.hrs-grid__cell`, `.hrs-grid__group`, `.hrs-grid__placeholder`; numeric columns (`align="end"`) put `.hrs-num` on their header and cells.
**Consumer provides:** items, columns and their templates, sort and selection state, the look. **Material:** `matSort` on the header row; no `mat-table` (see Table).
