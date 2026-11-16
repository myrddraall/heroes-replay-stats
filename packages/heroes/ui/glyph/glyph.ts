import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { StyledText, type StyledTextKind } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * A glyph (presentational), to put in a shaped frame (`hrs-circle-frame`, `hrs-hex-frame`): its
 * content, a Material icon or a capital letter, 1em at its `font-size` (the frame's), a letter at
 * 0.875 of it (a bold capital fills more of its em than an icon does) and centred on its capitals,
 * not the font's line. In one of the theme's styled looks (`styled`: `base`, the theme's colour,
 * unless set otherwise; `bright`; `glow`), or plain in the theme's text colour (`null`), as whoever
 * places it sets it: it knows nothing of the frame it is in.
 */
@Component({
  selector: 'hrs-glyph',
  imports: [NgTemplateOutlet, StyledText],
  templateUrl: './glyph.html',
  styleUrl: './glyph.scss',
})
export class Glyph {
  /** In one of the theme's styled looks (`base` unless set); `null`, plain. */
  readonly styled = input<StyledTextKind | null>('base');
}
