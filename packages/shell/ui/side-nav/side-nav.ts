import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry } from '../../model';

/**
 * Level 3 (presentational; the theme's SideNav): the page's own sections as a column at the left
 * of its content, staying in view while the page scrolls.
 */
@Component({
  selector: 'hrs-side-nav',
  imports: [RouterLink],
  templateUrl: './side-nav.html',
  host: { class: 'hrs-sidenav hrs-sidenav--sticky' },
})
export class SideNav {
  /** What the sections are of (Stats). */
  readonly title = input.required<string>();
  readonly sections = input.required<readonly ShellNavEntry[]>();
}
