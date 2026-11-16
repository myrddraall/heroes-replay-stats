import { Component } from '@angular/core';
import { Frame, FrameFront, Sprite, SpriteMask } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * The circle frame (presentational): the game's profile hero frame (the profile's
 * HeroPortraitSmallTemplate: Storm_UI_ProfileDialog_HeroFrame_*) around what is put in it (a glyph,
 * `hrs-glyph`; a portrait, `hrs-portrait`), in the theme's colour: blue, red, your own green on blue
 * (`blue-self`) or gold on red (`red-self`). The game ships the ring coloured per side; here its ally
 * ring, greyed, gives the shape, light and glow, and the theme the hue.
 *
 * It owns the layers, the mask and the states. The inside first: its background, its content cut
 * to a circle a little larger than the ring's see-through middle (its edge under the rim, so nothing
 * shows between them), and, `selected`, an inner glow (GenFX_CircleInnerGlow) over the content;
 * then the ring over it, its black middle cut away. Its `state`, only what it draws itself (one at
 * a time): `selected` (the inner glow) or `disabled` (greyed and dimmed); what is in it has its own
 * inputs, set by whoever composes them.
 *
 * Sized as every shaped frame: at its `font-size` the inside is 1.5em across (a glyph 1em in it,
 * a portrait filling it), the ring built round it (its inner edge 42 of its 64).
 */
@Component({
  selector: 'hrs-circle-frame',
  imports: [FrameFront, Sprite, SpriteMask],
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  templateUrl: './circle-frame.html',
  styleUrl: './circle-frame.scss',
})
export class CircleFrame {}
