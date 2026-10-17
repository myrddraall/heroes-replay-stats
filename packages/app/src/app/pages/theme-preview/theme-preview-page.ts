import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { BackgroundStore } from '../../scenes/play-background/background.store';

/** The glass opacity below which muted text loses WCAG AA contrast over the background's brightest sky. */
export const GLASS_ALPHA_FLOOR = 0.06;
/** How much the glass blurs what is behind it, when it does. */
const GLASS_BLUR = 'blur(6px)';

interface Variant {
  readonly label: string;
  readonly theme: string;
}

interface SamplePlayer {
  readonly name: string;
  readonly hero: string;
  readonly takedowns: number;
  readonly deaths: number;
}

interface SampleTeam {
  readonly label: string;
  readonly theme: string;
  readonly won: boolean;
  readonly players: readonly SamplePlayer[];
}

/**
 * The glass theme in preview, over the Play screen background: each variant's panel with the
 * usual components, and the variants mixed (a neutral panel holding the teams' rows). Its
 * controls set how see-through the glass is, whether it blurs what is behind it, whether the
 * background is tinted blue (over the site's colour, while the page is open), and which neutral
 * the page is in.
 */
@Component({
  selector: 'hrs-theme-preview-page',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatSliderModule,
  ],
  templateUrl: './theme-preview-page.html',
  styleUrl: './theme-preview-page.scss',
})
export class ThemePreviewPage {
  protected readonly floor = GLASS_ALPHA_FLOOR;
  protected readonly alpha = signal(0.5);
  protected readonly blur = signal(false);
  /** Whether the background is tinted blue (the vs A.I. blue, multiplied). */
  protected readonly blueTint = signal(false);
  private readonly background = inject(BackgroundStore);
  private readonly root = inject(DOCUMENT).documentElement;
  /** Whether the page's neutral is the Nexus one (blue and cyan) rather than the purple. */
  protected readonly nexus = signal(false);
  protected readonly backdrop = computed(() => (this.blur() ? GLASS_BLUR : 'none'));

  protected readonly variants: readonly Variant[] = [
    { label: 'Neutral', theme: 'hrs-glass-neutral' },
    { label: 'Nexus neutral', theme: 'hrs-glass-nexus' },
    { label: 'Blue team', theme: 'hrs-glass-blue' },
    { label: 'Red team', theme: 'hrs-glass-red' },
  ];

  protected readonly teams: readonly SampleTeam[] = [
    {
      label: 'Blue team',
      theme: 'hrs-glass-blue',
      won: true,
      players: [
        { name: 'Myrddraall', hero: 'Valla', takedowns: 14, deaths: 2 },
        { name: 'Nexus', hero: 'Johanna', takedowns: 11, deaths: 4 },
        { name: 'Starlight', hero: 'Malfurion', takedowns: 16, deaths: 1 },
      ],
    },
    {
      label: 'Red team',
      theme: 'hrs-glass-red',
      won: false,
      players: [
        { name: 'Hellfire', hero: 'Kerrigan', takedowns: 6, deaths: 7 },
        { name: 'Ashes', hero: 'Diablo', takedowns: 5, deaths: 6 },
        { name: 'Ember', hero: 'Li-Ming', takedowns: 7, deaths: 5 },
      ],
    },
  ];

  constructor() {
    // While the page is open it holds the background's tints; leaving gives back the site's.
    effect(() => {
      const blue = getComputedStyle(this.root).getPropertyValue('--hrs-background-tint-blue').trim();
      this.background.setPageTints({
        background: this.blueTint() ? { colour: blue, blend: 'multiply' } : null,
      });
    });
    inject(DestroyRef).onDestroy(() => this.background.setPageTints(null));
  }
}
