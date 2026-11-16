# Button
Square, 1px hrs-border, a faint vertical gradient from hrs-selection to hrs-tint, `nav-3`-weight label in hrs-text, centred. Hover: strong border and hover glow. Active: selection fill.
- **Primary** (`--primary`): the one action the view is for ("Import", "Delete"): strong border, selected glow, a glow-tinted gradient, label text-shadow. At most one per view; several equal-width primaries only in a Button row like the lobby's (Start Game | Leave Game | Invite).
- **Quiet** (`--quiet`): borderless, hrs-accent label; for in-text actions and toolbars.
- `--sm` for toolbars and table rows. Disabled: dim text, no glow.
- Labels are verbs in sentence case ("Watch solo"); the game's title case is not copied.
**Consumer provides:** label, optional leading icon, kind, size. **Material:** `mat-stroked-button` = default, `mat-flat-button` = primary, `mat-button` = quiet, via `mat.button-overrides` (shape 0, outline hrs-border, container colours from the mapping).
