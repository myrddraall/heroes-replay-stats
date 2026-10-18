import { DOCUMENT, Location } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GraphicsStore } from '../../../data/settings/graphics.store';
import { PlayBackground } from '../../../scenes/play-background/play-background';
import { MapPanel } from '../../maps/panel/map-panel';
import { AssetBrowser } from './asset-browser';
import { AssetCatalogStore } from './asset-catalog.store';
import { AssetInfo } from './asset-info';
import { LibraryHead } from './library-head';
import { typeLabel } from './library-types';
import { Editor } from './editor';
import { EditorBar } from './editor-bar';
import { EditorUiStore } from './editor-ui.store';
import { SceneTree } from './scene-tree';
import { SelectionPanel } from './selection-panel';

/**
 * An editor's layout (container, on the `Editor` in effect and the page's UI store): on the left
 * the library (its kind of thing as the title, the choice of it, the search, the editor's bar,
 * the list), or (once something is opened from them) a way back
 * to them, the editor's own head (`[editorHead]`) and its tree; on the right, while the lists
 * show, what is selected in them as information, else the properties of what is selected in the
 * tree; the background between them, showing what the editor provides; a back button
 * at the top left. The view's shape between the panels goes to the UI store, to fit a scene to it.
 * In the screenshot mode it shows nothing but the background, full screen, until Esc.
 */
@Component({
  selector: 'hrs-editor-layout',
  imports: [
    PlayBackground,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatDrawerContainer,
    MatDrawer,
    MatDrawerContent,
    MapPanel,
    EditorBar,
    SceneTree,
    SelectionPanel,
    AssetBrowser,
    AssetInfo,
    LibraryHead,
  ],
  templateUrl: './editor-layout.html',
  styleUrl: './editor-layout.scss',
  host: {
    '(document:fullscreenchange)': 'fullscreenChanged()',
    '(document:keydown.escape)': 'ui.setScreenshot(false)',
  },
})
export class EditorLayout {
  protected readonly editor = inject(Editor);
  protected readonly ui = inject(EditorUiStore);
  protected readonly graphics = inject(GraphicsStore);
  private readonly catalog = inject(AssetCatalogStore);
  /** The left panel's title while the library shows: the kind of thing listed. */
  protected readonly libraryTitle = computed(() => typeLabel(this.catalog.type()));
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly sceneHost = viewChild.required('scene', { read: ElementRef });
  private readonly document = inject(DOCUMENT);

  constructor() {
    // The screenshot mode is the whole screen where the browser allows it; leaving it, the page again.
    effect(() => {
      const fullscreen = this.document.fullscreenElement !== null;
      if (this.ui.screenshot() && !fullscreen)
        void this.document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (!this.ui.screenshot() && fullscreen) void this.document.exitFullscreen?.();
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const host = this.sceneHost().nativeElement as HTMLElement;
      const sized = new ResizeObserver(() =>
        this.ui.setAspect(host.clientWidth / Math.max(1, host.clientHeight)),
      );
      sized.observe(host);
      destroyRef.onDestroy(() => sized.disconnect());
    });
  }

  /** The browser left full screen (Esc, or its own control): the screenshot mode ends with it. */
  protected fullscreenChanged(): void {
    if (!this.document.fullscreenElement) this.ui.setScreenshot(false);
  }

  /**
   * Back to the page this one was opened from; to the start when it was opened on its own (the
   * site's first navigation landed here: history before it isn't the site's).
   */
  protected back(): void {
    const id = (this.location.getState() as { navigationId?: number } | null)?.navigationId ?? 1;
    if (id > 1) this.location.back();
    else void this.router.navigateByUrl('/');
  }
}
