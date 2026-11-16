import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BackgroundControl } from '../../data';
import { ThemePreviewFrames } from './theme-preview-frames';

interface Variant {
  readonly label: string;
  readonly theme: Theme;
}

/** The themes a page can be in (`theme`). */
type Theme = 'purple' | 'magenta' | 'cyan' | 'blue' | 'red';

interface SamplePlayer {
  readonly name: string;
  readonly hero: string;
  readonly takedowns: number;
  readonly deaths: number;
}

interface SampleTeam {
  readonly label: string;
  readonly theme: Theme;
  readonly won: boolean;
  readonly players: readonly SamplePlayer[];
}

/**
 * The site's theme in preview, over the Play screen background: a panel in each of its themes with
 * Material's usual components, and the themes mixed (a neutral panel holding the teams' rows). Its
 * control tints the background blue (over the site's colour, while the page is open); the panels'
 * opacity and blur are the site's (Settings, Theme).
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
    ThemePreviewFrames,
  ],
  templateUrl: './theme-preview-page.html',
  styleUrl: './theme-preview-page.scss',
})
export class ThemePreviewPage {
  /** Whether the background is tinted blue (the vs A.I. blue, multiplied). */
  protected readonly blueTint = signal(false);
  private readonly background = inject(BackgroundControl);
  private readonly root = inject(DOCUMENT).documentElement;

  protected readonly variants: readonly Variant[] = [
    { label: 'Purple', theme: 'purple' },
    { label: 'Magenta', theme: 'magenta' },
    { label: 'Cyan', theme: 'cyan' },
    { label: 'Blue team', theme: 'blue' },
    { label: 'Red team', theme: 'red' },
  ];

  protected readonly teams: readonly SampleTeam[] = [
    {
      label: 'Blue team',
      theme: 'blue',
      won: true,
      players: [
        { name: 'Myrddraall', hero: 'Valla', takedowns: 14, deaths: 2 },
        { name: 'Nexus', hero: 'Johanna', takedowns: 11, deaths: 4 },
        { name: 'Starlight', hero: 'Malfurion', takedowns: 16, deaths: 1 },
      ],
    },
    {
      label: 'Red team',
      theme: 'red',
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
      const blue = getComputedStyle(this.root)
        .getPropertyValue('--hrs-background-tint-blue')
        .trim();
      this.background.setPageTints({
        background: this.blueTint() ? { colour: blue, blend: 'multiply' } : null,
      });
    });
    inject(DestroyRef).onDestroy(() => this.background.setPageTints(null));
  }
}
