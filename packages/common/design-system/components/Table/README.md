# Table
Rows of data with uppercase `label` column headers on a hairline, `small` cells in hrs-text-muted with the first column in hrs-text, faint row hairlines, tabular numbers right-aligned (`.hrs-num`).
- Sortable headers carry `aria-sort` and show the arrow in hrs-border-strong.
- Hover: hover film. Selected row (`is-selected`): selection fill and an inset strong border ring; one selected row at a time, and only where selecting does something (opens details).
- Player names take their colour: `.hrs-team-blue`, `.hrs-team-red`, `.hrs-self`.
- Dense tables (stat tables) keep the same look at `--hrs-control-sm` row height; wide ones scroll inside `.hrs-scroll`, never the page.
**Consumer provides:** columns, rows, sort state, selection. **Material:** plain `<table>` as today's ui-stat-table; `mat-table` is not used. Sort header: `matSort` with the arrow hidden and `aria-sort` styled here.
