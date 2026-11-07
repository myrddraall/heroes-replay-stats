import { Component, computed, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { HeroFrame } from '../hero-frame/hero-frame';

/** The game's minimap icon size: its pictures are 32px, the hero's circle 26 of that (3px clear around). */
const MINIMAP_ICON_SIZE = 32;

/**
 * A hero's minimap icon (`picture`), named for the hero, in the profile hero frame (the ring in
 * the theme's colour); the ring empty without a picture. The icon is 1em square, so `font-size`
 * on it sizes the icon (32px unless the page sets its own), the ring built around it. A picture
 * shows at the game's scale, its width over the minimap's 32px: Xal'atath's, 26px with no clear
 * edge, is the same circle as the others'.
 */
@Component({
  selector: 'hrs-hero-minimap-icon',
  imports: [HeroFrame, Sprite],
  template: `<hrs-hero-frame>
    <span class="icon">
      @if (picture(); as picture) {
        <span class="icon__art" [style.font-size.em]="scale()">
          <img [hrsSprite]="picture" spriteCover [alt]="name()" />
        </span>
      }
    </span>
  </hrs-hero-frame>`,
  styles: `
    :host {
      display: inline-flex;
      font-size: 32px;
      flex: none;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 1em;
      height: 1em;
    }
    .icon__art {
      width: 1em;
      height: 1em;
      overflow: hidden;
    }
  `,
})
export class HeroMinimapIcon {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
  /** The picture's size in the icon: its width over the game's 32px (a file's, the whole icon). */
  protected readonly scale = computed(() => {
    const width = this.picture()?.rect?.[2];
    return width === undefined ? 1 : width / MINIMAP_ICON_SIZE;
  });
}
