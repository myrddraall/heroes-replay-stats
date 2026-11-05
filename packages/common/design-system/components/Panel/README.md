# Panel
The one container: square, film over the scene (hrs-tint at hrs-surface-alpha), 1px hrs-border, no shadow. Everything on a page that groups content is a Panel.
- Optional header row: `panel-title` uppercase, hairline below, icon buttons at the right end.
- `--raised` for anything that floats (uses hrs-tint-raised, hrs-surface-alpha-raised, panel glow and shade). `--plain` when the content is the page itself (a hero header over the art).
- Never nest a Panel in a Panel; use a SectionHeading or a Divider inside instead.
- A panel must not clip itself (`overflow: hidden` on the panel kills its glow); what needs clipping clips itself.
**Consumer provides:** header text and actions, body. **Material:** `mat-card` is replaced by this class; dialogs/menus take the raised film through the Material mapping in bundle.css.
