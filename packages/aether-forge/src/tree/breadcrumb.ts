import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** One level of where an editor is (see `Editor.crumbs`): its row's key (none: all of what is open), its name. */
export interface Crumb {
  readonly key: string | null;
  readonly label: string;
}

/**
 * Where an editor is, as a path over its tree (presentational): what is open, then each thing it
 * is inside, the last where it is; a level above picked goes back out to it.
 */
@Component({
  selector: 'forge-breadcrumb',
  imports: [MatIcon],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
})
export class Breadcrumb {
  readonly crumbs = input.required<readonly Crumb[]>();
  readonly crumbPick = output<string | null>();
}
