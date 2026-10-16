import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import type { Arena } from '@myrddraall/heroes-replay-stats-map';

/**
 * The map's view controls (presentational), pinned in the information panel: which arena is
 * shown, on a map of several, and whether the teams are shown in each other's colours. Nothing
 * when the map has neither.
 */
@Component({
  selector: 'hrs-map-view-controls',
  imports: [MatButtonToggleGroup, MatButtonToggle, MatButton, MatIcon],
  templateUrl: './map-view-controls.html',
  styleUrl: './map-view-controls.scss',
})
export class MapViewControls {
  /** The pack's arenas; the switcher shows for more than one. */
  readonly arenas = input<readonly Arena[]>([]);
  /** The arena shown, by index. */
  readonly arena = input(0);
  /** Whether the map has team colour to swap; the toggle shows for it. */
  readonly hasTeamColour = input(false);
  readonly teamColoursSwapped = input(false);

  readonly arenaChange = output<number>();
  readonly teamColoursToggle = output<void>();
}
