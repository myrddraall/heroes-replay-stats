import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import type { ShellNav } from '../../model';

/**
 * Level 1 of the shell (presentational; the theme's TopBar, a `mat-toolbar` over the bar's
 * textures): the logo, the areas with the game's
 * separator between their families, and the utility cluster (projected). On a handset (`menu`;
 * the shell's `hrs-shell--handset` shows the title) the logo and areas give way to the menu
 * button and the current area's title.
 */
@Component({
  selector: 'hrs-top-bar',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, RouterLink, Sprite],
  templateUrl: './top-bar.html',
  styleUrl: './top-bar.scss',
})
export class TopBar {
  readonly areas = input.required<ShellNav['areas']>();
  /** Whether it has the menu button (a handset's, opening the nav drawer). */
  readonly menu = input(false);
  /** What the page shown is (the current area), shown on a handset. */
  readonly title = input<string | null>(null);
  /** Whether the nav drawer the menu button opens is open. */
  readonly menuOpen = input(false);
  /** The menu button was pressed (a handset's nav drawer). */
  readonly menuRequested = output<void>();
  /** The eight sparkle triangles of the selected area. */
  protected readonly sparks = [0, 1, 2, 3, 4, 5, 6, 7];
}
