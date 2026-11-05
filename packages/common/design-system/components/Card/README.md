# Card
An item tile after the Collection: art on top, name in `nav-3`, a `label`-style status line in hrs-gold (OWNED, MVP, NEW). Film and hairline; hover strong border and glow; `is-selected` selected glow. `--empty` draws a faint placeholder slot. `--wide` lays art and text side by side for list contexts.
- With a rarity theme (`theme="legendary"`), the border, glow and name take that tier's colours (see Rarity).
- Art is the consumer's image (hero portrait, map thumbnail); the placeholder letters here stand in for it.
**Consumer provides:** art, name, status, theme (rarity), selection. **Material:** replaces `mat-card`.
