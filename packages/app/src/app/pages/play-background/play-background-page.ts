import {
  Component,
  ElementRef,
  afterNextRender,
  DestroyRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GraphicsStore } from '../../data/settings/graphics.store';
import { PlayBackground } from '../../scenes/play-background/play-background';
import { MapPanel } from '../maps/panel/map-panel';
import { SceneHeader } from './editor/scene-header';
import { SceneTree } from './editor/scene-tree';
import { SelectionPanel } from './editor/selection-panel';
import { PlayBackgroundPageStore } from './play-background-page.store';

/**
 * The Play screen background on its own, filling the window, as an editor of its scenes
 * (container; {@link PlayBackgroundPageStore}): on the left the scene's planet (`?planet=` in the
 * URL; none: the random sets), the view's options and the scene as a tree; on the right the
 * properties of what is selected; the background between them, a back button at the top left.
 */
@Component({
  selector: 'hrs-play-background-page',
  imports: [
    PlayBackground,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatDrawerContainer,
    MatDrawer,
    MatDrawerContent,
    MapPanel,
    SceneHeader,
    SceneTree,
    SelectionPanel,
  ],
  providers: [PlayBackgroundPageStore],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  /** The scene's planet, by id, from the URL's `?planet=`; none: the random sets. */
  readonly planet = input<string>();

  protected readonly store = inject(PlayBackgroundPageStore);
  protected readonly graphics = inject(GraphicsStore);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly sceneHost = viewChild.required('scene', { read: ElementRef });

  constructor() {
    this.store.showPlanet(this.planet);
    // The view's shape between the panels, for the scene to be fitted to it.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const host = this.sceneHost().nativeElement as HTMLElement;
      const sized = new ResizeObserver(() =>
        this.store.setAspect(host.clientWidth / Math.max(1, host.clientHeight)),
      );
      sized.observe(host);
      destroyRef.onDestroy(() => sized.disconnect());
    });
  }

  /** A planet chosen: put in the URL, which shows it ('' takes it out: the random sets). */
  protected choosePlanet(id: string): void {
    void this.router.navigate([], {
      queryParams: { planet: id || null },
      queryParamsHandling: 'merge',
    });
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
