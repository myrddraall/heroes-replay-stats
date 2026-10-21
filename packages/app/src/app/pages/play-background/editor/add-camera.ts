import { Component, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** The button to add a camera to the scene (presentational): one where the view looks from; in the section of its cameras. */
@Component({
  selector: 'hrs-add-camera',
  imports: [MatIcon],
  templateUrl: './add-camera.html',
  styleUrl: './properties-panel.scss',
})
export class AddCamera {
  readonly added = output<void>();
}
