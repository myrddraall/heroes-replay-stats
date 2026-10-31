import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { FORGE_OPTIONS } from '../forge-options';
import { AssetCatalogStore } from './asset-catalog.store';
import { EditorUiStore } from '../layout/editor-ui.store';
import { LIBRARY_TYPES } from './library-types';
import { NewSceneFlyout, type SceneTemplate } from './new-scene-flyout';
import { ViewMenu } from '../layout/view-menu';
import type { OpenKind } from '../layout/open-target';

/**
 * The library's head (container, on the page's catalog): which kind of thing is listed, the
 * search over it, and, for the scenes, a button for a new one whose flyout names it and starts it
 * empty or from any scene (the presets first); the view's menu at the row's end.
 */
@Component({
  selector: 'forge-library-head',
  imports: [MatIcon, ViewMenu, CdkOverlayOrigin, CdkConnectedOverlay, NewSceneFlyout],
  templateUrl: './library-head.html',
  styleUrl: './library-head.scss',
})
export class LibraryHead {
  protected readonly catalog = inject(AssetCatalogStore);
  private readonly ui = inject(EditorUiStore);
  protected readonly types = LIBRARY_TYPES;
  protected readonly options = inject(FORGE_OPTIONS);
  /** Whether the new scene's flyout is open. */
  protected readonly flyout = signal(false);
  /** Under the button, or above it where there is no room below. */
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  /** The scenes a new one can start from: all of them, the presets first. */
  protected readonly templates = computed((): SceneTemplate[] =>
    this.catalog.scenes().map((s) => ({ id: s.id, label: s.label, shows: s.shows })),
  );

  protected create(choice: { readonly from?: string; readonly name: string }): void {
    this.flyout.set(false);
    this.catalog.createScene(choice.from, choice.name);
  }

  protected typeChosen(event: Event): void {
    this.setType((event.target as HTMLSelectElement).value);
  }

  private setType(type: string): void {
    if (LIBRARY_TYPES.some((t) => t.value === type)) this.ui.showKind(type as OpenKind);
  }

  protected search(event: Event): void {
    this.catalog.setQuery((event.target as HTMLInputElement).value);
  }
}
