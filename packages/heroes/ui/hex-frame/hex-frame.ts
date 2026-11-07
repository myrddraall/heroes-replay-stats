import { Component, input } from '@angular/core';
import { Frame, FrameBack, FrameFront, Sprite, SpriteMask } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * The hex frame (presentational): the circle frame's hexagon counterpart, flat at top and bottom,
 * around what is put in it (a glyph, `hrs-glyph`; a portrait, `hrs-portrait`): the game's death
 * announcement portrait frame (HUD_DeathAnnouncement_*_Portrait, which it ships blue, red and green
 * as the ring's ally, enemy and self) in the theme's colour; as with the ring, its blue one, greyed,
 * gives the shape, light and glow, and the theme the hue.
 *
 * It owns the layers, the mask and the states. As the game draws it (DeathTimer's
 * DeadPlayerAnnouncementTemplate: the portrait cut to a hexagon, then the border), the inside first:
 * its background (reaching a little under the rim, so none of the rim's soft inner edge shows
 * through), its content cut to the hexagon, and, `selected`, an inner glow
 * (GenFX_HexagonInnerGlow) over the content; then the rim over it all (its art is clear inside).
 * Its `state`, only what it draws itself (one at a time): `selected` (the inner glow) or
 * `disabled` (greyed and dimmed); what is in it has its own inputs, set by whoever composes them.
 *
 * Its `orientation`: `flat` (flat at top and bottom, the game's) or `pointy` (pointed at top and
 * bottom, its flats the sides): the same frame turned a quarter (its rim, background, mask and
 * inner glow), what is in it upright.
 *
 * Sized as every shaped frame: at its `font-size` the inside is 1.5em across its flats (a glyph 1em
 * in it, a portrait filling it), the rim built round it.
 */
@Component({
  selector: 'hrs-hex-frame',
  imports: [FrameBack, FrameFront, Sprite, SpriteMask],
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  host: { '[class.pointy]': "orientation() === 'pointy'" },
  templateUrl: './hex-frame.html',
  styleUrl: './hex-frame.scss',
})
export class HexFrame {
  readonly orientation = input<'flat' | 'pointy'>('flat');
}
