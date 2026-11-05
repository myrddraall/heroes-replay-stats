import { Component, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * A hero's minimap icon (`picture`), named for the hero; nothing without a picture. A square of
 * 1em, so `font-size` on it sizes it (32px unless the page sets its own).
 */
@Component({
  selector: 'hrs-hero-minimap-icon',
  imports: [Sprite],
  template: `@if (picture(); as picture) {
    <img [hrsSprite]="picture" spriteCover [alt]="name()" />
  }`,
  styles: `
    :host {
      display: inline-block;
      font-size: 32px;
      width: 1em;
      height: 1em;
      flex: none;
      overflow: hidden;
    }
  `,
})
export class HeroMinimapIcon {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
}
