import { Component, computed, inject } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { ownScene } from '../../../scenes/play-background/background-design';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { AssetCatalogStore } from './asset-catalog.store';
import { LIBRARY_TYPES } from './library-types';
import type { OpenKind } from './open-target';

/**
 * The library's head (container, on the page's catalog): which kind of thing is listed, the
 * search over it, and, for the scenes, a button for a new one: empty, or a copy of one of the
 * user's own, chosen from its flyout.
 */
@Component({
  selector: 'hrs-library-head',
  imports: [PropertySelect, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatDivider],
  templateUrl: './library-head.html',
  styleUrl: './library-head.scss',
})
export class LibraryHead {
  protected readonly catalog = inject(AssetCatalogStore);
  protected readonly types: readonly PropertyOption[] = LIBRARY_TYPES;
  /** The scenes a new one can be a copy of: the user's own (a preset's planets aren't one planet). */
  protected readonly templates = computed(() =>
    this.catalog.scenes().filter((s) => ownScene(s.id)),
  );

  protected setType(type: string): void {
    if (LIBRARY_TYPES.some((t) => t.value === type)) this.catalog.setType(type as OpenKind);
  }

  protected search(event: Event): void {
    this.catalog.setQuery((event.target as HTMLInputElement).value);
  }
}
