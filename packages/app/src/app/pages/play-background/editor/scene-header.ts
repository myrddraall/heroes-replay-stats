import { Component, inject, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { PlayBackgroundPageStore } from '../play-background-page.store';
import { PropertySelect } from '../properties/property-select';

/**
 * The scene panel's head (container, on the page's store): the planet the scene is of (chosen
 * here, shown as the URL says: `planetChange` asks for it), the view's options behind a gear (the
 * names; the whole scene reset, confirmed first), and the moon the view is centred on.
 */
@Component({
  selector: 'hrs-scene-header',
  imports: [
    PropertySelect,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
  ],
  templateUrl: './scene-header.html',
  styleUrl: './scene-header.scss',
})
export class SceneHeader {
  protected readonly store = inject(PlayBackgroundPageStore);
  /** A planet chosen, by id ('': the random sets). */
  readonly planetChange = output<string>();
}
