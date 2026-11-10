import { Component, computed, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { CircleFrame } from '../circle-frame/circle-frame';
import { Portrait, type PortraitSource } from '../portrait/portrait';

/** The game's minimap icon size: its pictures are 32px, the hero's circle 26 of that (3px clear around). */
const MINIMAP_ICON_SIZE = 32;
const MINIMAP_ICON_ART = 26;

/**
 * A hero's minimap icon (`picture`), named for the hero, in the circle frame (`hrs-circle-frame`,
 * the ring in the theme's colour); the frame empty without a picture. Sized as the frame: at a
 * `font-size` the icon's circle is the frame's inside (1.5em across), the ring built round it (a
 * 32px icon unless the page sets its own size). A picture shows at the game's scale, its width over
 * the minimap's 32px: Xal'atath's, 26px with no clear edge, is the same circle as the others'.
 */
@Component({
  selector: 'hrs-hero-minimap-icon',
  imports: [CircleFrame, Portrait],
  template: `<hrs-circle-frame>
    <hrs-portrait [sources]="sources()" [name]="name()" />
  </hrs-circle-frame>`,
  styles: `
    :host {
      display: inline-flex;
      /* a 32px icon: its circle (26 of it) the frame's 1.5em inside */
      font-size: calc(32px * 26 / 32 / 1.5);
      flex: none;
    }
  `,
})
export class HeroMinimapIcon {
  readonly picture = input<SpritePicture | null>(null);
  readonly name = input.required<string>();
  /** The picture, its size over the frame's inside its width over the art's 26 of the minimap's 32. */
  protected readonly sources = computed((): PortraitSource[] => {
    const picture = this.picture();
    const scale = (picture?.rect?.[2] ?? MINIMAP_ICON_SIZE) / MINIMAP_ICON_ART;
    return picture ? [{ picture, scale }] : [];
  });
}
