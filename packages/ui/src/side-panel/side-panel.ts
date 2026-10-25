import { Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * The map's side panel (presentational): its title, a close button, what is pinned under the
 * title (`uiSidePanelPinned`, which stays put), and a scrolling body for whatever other sections a
 * mode puts in it. Its width is `--ui-side-panel-width`.
 */
@Component({
  selector: 'ui-side-panel',
  imports: [MatIconButton, MatIcon],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.scss',
})
export class SidePanel {
  readonly title = input.required<string>();
  /** The close button was pressed. */
  readonly closeRequested = output<void>();
}
