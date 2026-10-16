import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PlayBackground } from '../../scenes/play-background/play-background';
import { TintControls } from './tint-controls';
import { PRESETS, type TintPreset, type TintSettings, UNTINTED, tintStyles } from './tint-settings';

/**
 * The Play screen background on its own, filling the window: nothing else on the page but a
 * button in the corner opening controls to tint it, the whole of it or each planet on its own.
 */
@Component({
  selector: 'hrs-play-background-page',
  imports: [PlayBackground, TintControls, MatButton, MatIcon],
  templateUrl: './play-background-page.html',
  styleUrl: './play-background-page.scss',
})
export class PlayBackgroundPage {
  private readonly root = inject(DOCUMENT).documentElement;
  protected readonly presets = PRESETS;
  protected readonly settings = signal<TintSettings>(UNTINTED);
  protected readonly styles = computed(() => tintStyles(this.settings()));
  protected readonly open = signal(false);

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
