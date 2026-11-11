# Portrait
A player's square portrait with a frame, for rosters, lobby rows, score tables and the replay header. There is no account or profile in HRS, so it never appears in the TopBar.
- Built around 1em: the initials are 1em, the frame is 3em square, border 0.125em, the level plate 0.65em; `font-size` is the only size control (12px → 36px in rows, 28px → 84px in a header).
- The frame is the theme's strong border with the theme's glow, so a portrait inside a `blue` or `red` panel carries its team; `--mvp` swaps the frame to hrs-gold. The level plate (hero level in the match) is optional.
- The frame art is a game asset (`storm_ui_profiledialog_portraitframe`, rank borders) drawn with the 9-slice component once extracted; until then the CSS border.
- No image: initials in hrs-text-muted on hrs-tint-raised.
**Consumer provides:** image or initials, level (optional), font-size, the theme on an ancestor. **Material:** none; plain element.
