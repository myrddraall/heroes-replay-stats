import { CameraDrag } from '../viewport/camera-drag';
import { DraftDesignStore } from '../draft/draft-design.store';
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
import { FORGE_OPTIONS } from '../forge-options';
import { SceneView } from '@myrddraall/heroes-replay-stats-aether/view';
import { SidePanel } from '@myrddraall/heroes-replay-stats-ui';
import { AssetBrowser } from '../library/asset-browser';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import { AssetInfo } from '../library/asset-info';
import { LibraryHead } from '../library/library-head';
import { ResetConfirm } from './reset-confirm';
import { ClearConfirm } from './clear-confirm';
import { typeLabel } from '../library/library-types';
import { Editor } from '../editing/editor';
import { EditorBar } from './editor-bar';
import { EditorUiStore } from './editor-ui.store';
import { SceneTree } from '../tree/scene-tree';
import { SelectionPanel } from '../panel/selection-panel';
import { EditingAidsStore } from '../aids/editing-aids.store';
import { ReferenceOverlay } from '../viewport/reference-overlay';
import { LookThrough } from '../viewport/look-through';
import { type PoleDrag, SceneMarkers } from '../viewport/scene-markers';
import { FrameStatsReadout } from '../diagnostics/frame-stats-readout';

/**
 * An editor's layout (container, on the `Editor` in effect and the page's UI store): on the left
 * the library (its kind of thing as the title, the choice of it, the search, the editor's bar,
 * the list), or (once something is opened from them) a way back
 * to them, the editor's own head (`[editorHead]`) and its tree; on the right, while the lists
 * show, what is selected in them as information, else the properties of what is selected in the
 * tree; the background between them, showing what the editor provides (the reference image over
 * it, where one is chosen and shown); a back button
 * at the top left. The view's shape between the panels goes to the UI store, to fit a scene to it.
 * In the screenshot mode it shows nothing but the background, full screen, until Esc.
 */
@Component({
  selector: 'forge-editor-layout',
  imports: [
    SceneView,
    CameraDrag,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatDrawerContainer,
    MatDrawer,
    MatDrawerContent,
    SidePanel,
    EditorBar,
    SceneTree,
    SelectionPanel,
    AssetBrowser,
    AssetInfo,
    LibraryHead,
    ResetConfirm,
    ClearConfirm,
    ReferenceOverlay,
    LookThrough,
    SceneMarkers,
    FrameStatsReadout,
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
  protected readonly options = inject(FORGE_OPTIONS);
  protected readonly aids = inject(EditingAidsStore);
  /** The draft, for a drag of the camera taken as one change. */
  protected readonly draft = inject(DraftDesignStore);
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

  /** A planet clicked in the view: selected in the editor (from the library: what it shows, opened). */
  /** A planet's pole dragged in the view: its axis moved, the whole drag one step. */
  protected poleDrag(drag: PoleDrag): void {
    if (drag.phase === 'start') this.draft.holdHistory();
    this.editor.dragPole(drag);
    if (drag.phase === 'end') this.draft.releaseHistory();
  }

  protected pick(index: number): void {
    if (this.editor.selectPlaced(index) && this.ui.browsing()) this.ui.open(this.editor.opened());
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
    else void this.router.navigateByUrl(this.options.exit);
  }
}
