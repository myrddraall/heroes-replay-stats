import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry, ShellSideEntry } from '../../model';

/**
 * Level 3 (presentational; the theme's SideNav): the page's own sections as a column at the left
 * of its content, staying in view while the page scrolls: one group under a heading that folds it.
 * A section with sub-items (Stats) shows them on a guide under it while the page shown is in it,
 * and is the trail to the current one.
 */
@Component({
  selector: 'hrs-side-nav',
  imports: [RouterLink],
  templateUrl: './side-nav.html',
  host: { class: 'hrs-sidenav hrs-sidenav--sticky' },
})
export class SideNav {
  /** What the sections are of (the match). */
  readonly title = input.required<string>();
  readonly sections = input.required<readonly ShellSideEntry[]>();
  /** Whether the group is unfolded. */
  protected readonly open = signal(true);

  protected hasActive(entries: readonly ShellNavEntry[]): boolean {
    return entries.some((e) => e.active);
  }
}
