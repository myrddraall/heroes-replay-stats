import { Component } from '@angular/core';
import { Frame, FrameBack, Sprite, SpriteMask } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * The game's profile hero frame (the profile's HeroPortraitSmallTemplate:
 * Storm_UI_ProfileDialog_HeroFrame_*) around its content, a hero's round icon, the ring in the
 * theme's colour: blue, red, the user's own green on blue (`blue-self`) or gold on red
 * (`red-self`). The game ships the ring coloured per side; here its ally ring, greyed, gives the
 * shape, light and glow, and the theme the hue. The content is laid out at its own size (an icon
 * 1em square, at the frame's `font-size`) and the ring is built around it, its inner edge on the
 * icon's circle (an icon's art fills 26 of its 32): the frame is 26/21em across.
 */
@Component({
  selector: 'hrs-hero-frame',
  imports: [FrameBack, Sprite, SpriteMask],
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  template: `
    <span hrsFrameBack class="ring">
      <span class="ring__colour" hrsSpriteMask="profile#hero-frame"></span>
      <img class="ring__light" hrsSprite="profile#hero-frame" spriteCover loading="eager" alt="" />
    </span>
    <ng-content />
  `,
  styleUrl: './hero-frame.scss',
})
export class HeroFrame {}
