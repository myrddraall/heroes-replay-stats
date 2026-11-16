import { Component } from '@angular/core';
import { Frame, FrameFront, Sprite, SpriteMask } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * The square frame (presentational): the circle and hex frames' square counterpart, around what is
 * put in it (a glyph, `hrs-glyph`; a portrait, `hrs-portrait`): the game's profile portrait border
 * (the profile dialog's UserPortraitFrameTemplate: Storm_UI_ProfileDialog_AvatarFrame), greyed for
 * its shape and light, in the theme's colour.
 *
 * It owns the layers, the mask and the states. The inside first: its background and its content cut
 * to a square a little larger than the border's see-through middle (its edge under the border, so
 * nothing shows between them), and, `selected`, an inner glow over the content (the game's square
 * glow, GenFX_3pxBorderGlow, its bright line under the border and its fade reaching in); then the
 * border over it all (its art is clear inside, with a soft shadow falling inward). Its `state`, only
 * what it draws itself (one at a time): `selected` (the inner glow) or `disabled` (greyed and
 * dimmed); what is in it has its own inputs, set by whoever composes them.
 *
 * Sized as every shaped frame: at its `font-size` the inside is 1.5em across (a glyph 1em in it, a
 * portrait filling it), the border built round it (its inner edge 130 of its 164).
 */
@Component({
  selector: 'hrs-square-frame',
  imports: [FrameFront, Sprite, SpriteMask],
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  templateUrl: './square-frame.html',
  styleUrl: './square-frame.scss',
})
export class SquareFrame {}
