import { Component, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * A hero's leaderboard portrait (`picture`, 100 × 56 as the game draws it), named for the hero;
 * nothing without a picture. 1em high and as wide as the portrait's shape, so `font-size` on it
 * sizes it (56px unless the page sets its own).
 */
@Component({
  selector: 'hrs-hero-portrait',
  imports: [Sprite],
  template: `@if (picture(); as picture) {
    <img [hrsSprite]="picture" spriteCover [alt]="name()" />
  }`,
  styles: `
    :host {
      display: inline-block;
      font-size: 56px;
      width: calc(1em * 100 / 56);
      height: 1em;
      flex: none;
      overflow: hidden;
    }
  `,
})
export class HeroPortrait {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
}
