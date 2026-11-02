import { Component, input } from '@angular/core';
import { Sprite, type SpritePicture } from '@myrddraall/heroes-replay-stats-common/ui';

/** A hero's minimap icon (`picture`), named for the hero; nothing without a picture. */
@Component({
  selector: 'hrs-hero-minimap-icon',
  imports: [Sprite],
  template: `@if (picture(); as picture) {
    <img [hrsSprite]="picture" [spriteWidth]="32" [alt]="name()" />
  }`,
  styles: `
    :host {
      display: inline-block;
      width: 32px;
      height: 32px;
      flex: none;
    }
    img {
      display: block;
    }
  `,
})
export class HeroMinimapIcon {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
}
