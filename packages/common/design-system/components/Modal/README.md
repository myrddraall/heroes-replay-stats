# Modal
A full-page dialog after the game's Shards screen: the page behind is scrimmed (hrs-ground at hrs-scrim-alpha, optional hrs-backdrop-modal blur) and carries a faint triangle pattern; the dialog is a modal film with a strong border, a wide glow, an uppercase `display` title with a text glow, a subtitle, and the glow Divider under them. Actions are centred Buttons.
- Use for choices that block the page (confirm delete, pick a player as "me"). Everything else is a Drawer or a Popover.
- Close on Escape and on the Close button; never on scrim click when the dialog holds a form.
**Consumer provides:** title, subtitle, body, actions. **Material:** `mat-dialog` with `--mat-dialog-container-color: var(--hrs-film-modal)`, `--mat-dialog-container-shape: 0`, backdrop class `hrs-modal-scrim`.
