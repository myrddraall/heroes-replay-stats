# IconButton
A square Button holding one icon (Material Symbols in the app). Built around 1em: the icon is 1em and the frame 2.25em around it, so `font-size` is the size (16px → 36px, matching `hrs-control`; `--sm` only sets 0.78em). Always has an `aria-label`. Pressed/toggled state uses `aria-pressed`, styled like a ToggleGroup item.
**Material:** `mat-icon-button` via `mat.icon-button-overrides` (shape 0, state layer off, outline hrs-border).
