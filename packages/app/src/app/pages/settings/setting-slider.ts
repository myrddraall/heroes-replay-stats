import { Component, input, output } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';

/** A setting set with a slider (presentational): its label and value shown, and what it does. */
@Component({
  selector: 'hrs-setting-slider',
  imports: [MatSliderModule],
  templateUrl: './setting-slider.html',
  styleUrl: './setting-slider.scss',
})
export class SettingSlider {
  /** The slider's id, unique on the page. */
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  /** The value as shown. */
  readonly shown = input.required<string>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(1);
  readonly hint = input('');
  /** The user moved it. */
  readonly valueChange = output<number>();
}
