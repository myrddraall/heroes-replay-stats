import { Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * The map's side panel (presentational): its title, a close button, what is pinned under the
 * title (`hrsMapPanelPinned`, which stays put), and a scrolling body for whatever other sections a
 * mode puts in it. Its width is `--hrs-map-panel-width`.
 */
@Component({
  selector: 'hrs-map-panel',
  imports: [MatIconButton, MatIcon],
  templateUrl: './map-panel.html',
  styleUrl: './map-panel.scss',
})
export class MapPanel {
  readonly title = input.required<string>();
  /** The close button was pressed. */
  readonly closeRequested = output<void>();
}
