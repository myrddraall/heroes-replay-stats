import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ShellNavEntry, ShellSideEntry } from '../../model';

/**
 * Level 3 (presentational; the theme's SideNav): the page's own sections, one group without a
 * heading (the page names what the sections are of), in the shell's left-hand drawer.
 * A section with sub-items (Stats) shows them on a guide under it while the page shown is in it,
 * and is the trail to the current one.
 */
@Component({
  selector: 'hrs-side-nav',
  imports: [RouterLink],
  templateUrl: './side-nav.html',
  host: { class: 'hrs-sidenav' },
})
export class SideNav {
  /** What the sections are of (the match): the nav's name for screen readers, not shown (the page names it). */
  readonly title = input.required<string>();
  readonly sections = input.required<readonly ShellSideEntry[]>();

  protected hasActive(entries: readonly ShellNavEntry[]): boolean {
    return entries.some((e) => e.active);
  }
}
