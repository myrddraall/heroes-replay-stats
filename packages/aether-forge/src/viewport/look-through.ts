import { Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * What the view looks through (presentational): the editor's own camera or one of the scene's
 * (`options`, by id; one or none: nothing to choose), and, the editor's moved, a way back to
 * where the scene's primary is.
 */
@Component({
  selector: 'forge-look-through',
  imports: [MatIconButton, MatIcon, MatTooltip],
  templateUrl: './look-through.html',
  styleUrl: './look-through.scss',
})
export class LookThrough {
  readonly options = input.required<readonly { readonly id: string; readonly label: string }[]>();
  readonly look = input.required<string>();
  /** Whether the editor's camera is moved from the primary's (it can be put back). */
  readonly moved = input(false);
  readonly lookChange = output<string>();
  readonly resetRequested = output<void>();
}
