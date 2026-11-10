import { Component, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * A match award's badge as the game's score screen draws it (`picture`, 72 × 72, its glow inside),
 * named for the award; nothing without a picture. A square of 1em, so `font-size` on it sizes it
 * (72px unless the page sets its own).
 */
@Component({
  selector: 'hrs-award-badge',
  imports: [Sprite],
  template: `@if (picture(); as picture) {
    <img [hrsSprite]="picture" spriteCover [alt]="name()" />
  }`,
  styles: `
    :host {
      display: inline-block;
      font-size: 72px;
      width: 1em;
      height: 1em;
      flex: none;
      overflow: hidden;
    }
  `,
})
export class AwardBadge {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
}
