# Popover
A raised panel anchored to a control with a pointer, after the game's MENU flyout from the gear: a small uppercase header, then a Menu or a stack of Buttons.
- Raised film, hairline, panel glow and shade; the pointer is drawn in the border and fill colours.
- Keep it to one column, no more than ~8 items; otherwise it is a Drawer or a Modal.
**Consumer provides:** anchor, content, placement. **Material:** `mat-menu` panel takes `--mat-menu-container-color: var(--hrs-film-raised)` and the `.hrs-menu__item` look through `mat.menu-overrides`; the pointer is the Popover class only.
