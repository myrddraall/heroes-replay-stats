# StyledText
The game's display text treatments (its FontStyles: a face plus style flags for gradient fill and glow), as one class with three kinds. All three take their colours from the theme, so `theme="blue"` / `"red"` / `"self"` / `"purple"` on the element or an ancestor is the whole team variation.
- **base** (`--base`): the team colour (`hrs-accent`) with a thin dark shadow; player names and headings over art.
- **bright** (`--bright`): `hrs-text` core with a halo in `hrs-glow`; the best value in a column, a highlighted number.
- **glow** (`--glow`): gradient fill from `hrs-text` through `hrs-accent` into `hrs-glow`, plus the halo; team labels, the big kill counts and the best value on a team on the score screen. One element: the gradient is `background-clip: text`, the halo is `filter: drop-shadow`, so no duplicated text layers.
- No size modifiers: it is 1em and `font-size` sets it (72px for the kill counts, 24px for team labels, the table's own size for a best value); the halo radii are em with a px floor and cap, so a 13px best value still carries a visible glow and the 72px numerals don't bloom. Brand face, bold, tabular figures.
- Rarity themes work the same way: `theme="epic"` on the element or an ancestor gives the three kinds the tier's accent and glow at the tier's glow strength (poor and common barely glow, legendary most). Item names, loot lines, talent tiers.
- Use it on a few words or numbers per view, never on body copy or table cells at large; `bright` marks at most one value per column.
**Consumer provides:** the text, kind, font-size, and the theme on an ancestor. **Angular:** a `hrsStyledText` directive (`hrsStyledText="glow"`) that sets these classes; no component wrapper. Forced-colours mode drops the gradient and glow to plain text.
