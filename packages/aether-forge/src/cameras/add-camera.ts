import { Component, output } from '@angular/core';
import { SplitButton, type SplitOption } from '../controls/split-button';

/** The button to add a camera to the scene (presentational): one where the view looks from; in the section of its cameras. */
@Component({
  selector: 'forge-add-camera',
  imports: [SplitButton],
  templateUrl: './add-camera.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class AddCamera {
  readonly added = output<void>();
  protected readonly options: readonly SplitOption[] = [
    { id: 'view', label: 'From the view', icon: 'videocam' },
  ];
}
