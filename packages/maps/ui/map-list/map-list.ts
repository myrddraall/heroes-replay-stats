import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { MapCatalogItem } from '../../model';
import { Mask } from '@myrddraall/heroes-replay-stats-common/ui';
import { ItemFocus, ItemList, ItemTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';

/** The maps there are packs of (presentational): each one links to its map. */
@Component({
  selector: 'hrs-map-list',
  imports: [ItemFocus, ItemList, ItemTemplate, Mask, MatProgressBarModule, NgOptimizedImage, RouterLink],
  templateUrl: './map-list.html',
  styleUrl: './map-list.scss',
})
export class MapList {
  readonly maps = input.required<readonly MapCatalogItem[]>();
  readonly loading = input(false);
  /** Why the list couldn't be loaded. */
  readonly error = input<string | null>(null);

  protected readonly byId = (map: MapCatalogItem) => map.id;
}
