import { Component, input } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry } from '../../model';

/**
 * Level 2 of the shell (presentational; the theme's SubBar): the sections as a `mat-tab-nav-bar`
 * on the bar's band, the current one marked `aria-current="page"` (no tab panel: the sections are
 * pages).
 */
@Component({
  selector: 'hrs-sub-bar',
  imports: [MatTabsModule, RouterLink],
  template: `<nav
    mat-tab-nav-bar
    class="hrs-subbar"
    mat-stretch-tabs="false"
    mat-align-tabs="start"
    disableRipple
    [attr.aria-label]="label()">
    @for (section of sections(); track section.link) {
      <a mat-tab-link class="hrs-tab" [routerLink]="section.link" [active]="section.active">{{
        section.label
      }}</a>
    }
  </nav>`,
  styleUrl: './sub-bar.scss',
})
export class SubBar {
  readonly sections = input.required<readonly ShellNavEntry[]>();
  /** What the sections are, for screen readers. */
  readonly label = input('Sections');
}
