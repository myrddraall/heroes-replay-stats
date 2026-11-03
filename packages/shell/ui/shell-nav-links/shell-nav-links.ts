import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A link a page puts under its main nav item. */
export interface ShellNavLink {
  /** Absolute (`/maps/cursed-hollow`). */
  readonly path: string;
  readonly title: string;
}

/**
 * Plain links for under a main nav item (presentational), indented and marked when open, for a
 * page whose own navigation is just a list (`hrsShellNavChildren`).
 */
@Component({
  selector: 'hrs-shell-nav-links',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './shell-nav-links.html',
  styleUrl: './shell-nav-links.scss',
})
export class ShellNavLinks {
  readonly links = input.required<readonly ShellNavLink[]>();
  /** What the links are, for screen readers ("Cursed Hollow"). */
  readonly label = input.required<string>();
}
