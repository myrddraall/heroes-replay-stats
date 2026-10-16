import { DOCUMENT, Location } from '@angular/common';
import { Component, DestroyRef, effect, inject, resource, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { GraphicsStore } from '../../data/settings/graphics.store';
import { BackgroundStore } from '../../scenes/play-background/background.store';
import { PLAY_SCENE_URL } from '../../scenes/play-background/play-scene';
import { PlayBackground } from '../../scenes/play-background/play-background';
import { loadPlanetIndex } from '../../scenes/play-background/scene-planets';
import { TintControls } from './tint-controls';
import {
  backgroundTints,
  PRESETS,
  type TintPreset,
  type TintSettings,
  UNTINTED,
} from './tint-settings';

/**
 * The Play screen background on its own, filling the window: nothing else on the page but a back
 * button in the top left, and one in the top right opening controls to tint it, the whole of it or
 * each planet on its own.
 * The page holds the background's tints while it is open, over the site's colour; leaving it
 * gives the site's back. Its controls are in the Graphics settings' theme. A Review choice brings
 * in one planet on its own, centred, in place of the sets, while the page is open.
 */
/** Where a planet is put to review it: in the middle of the view, filling much of it. */
const REVIEW_POSITION: readonly [number, number, number] = [0, 65, 4];
const REVIEW_RADIUS = 18;
@Component({
  selector: 'hrs-play-background-page',
  imports: [
    PlayBackground,
    TintControls,
    MatButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatSlideToggle,
  ],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  private readonly root = inject(DOCUMENT).documentElement;
  protected readonly presets = PRESETS;
  protected readonly settings = signal<TintSettings>(UNTINTED);
  protected readonly open = signal(false);
  private readonly background = inject(BackgroundStore);
  protected readonly graphics = inject(GraphicsStore);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** The planets there are to review. */
  protected readonly planets = resource({
    loader: ({ abortSignal }) => loadPlanetIndex(PLAY_SCENE_URL, abortSignal),
  });
  /** The planet under review, by id; none: the sets. */
  protected readonly review = signal('');
  /** Whether the planets' names float over them. */
  protected readonly names = signal(false);

  constructor() {
    effect(() => this.background.setPageTints(backgroundTints(this.settings())));
    effect(() => {
      const id = this.review();
      this.background.setPagePlanets(
        id ? [{ id, position: REVIEW_POSITION, radius: REVIEW_RADIUS }] : null,
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.background.setPageTints(null);
      this.background.setPagePlanets(null);
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

  /** Another set of planets, flown to. */
  protected anotherSet(): void {
    this.background.nextPlanetSet();
  }

  /** A preset tints the whole background; the planets follow it. */
  protected choose(preset: TintPreset): void {
    const colour = preset.token
      ? getComputedStyle(this.root).getPropertyValue(preset.token).trim()
      : '#ffffff';
    this.settings.set({
      ...UNTINTED,
      background: { on: preset.token !== null, colour, blend: preset.blend },
    });
  }
}
