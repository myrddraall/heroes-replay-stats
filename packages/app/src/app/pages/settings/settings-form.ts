import { Component, input, output } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';

/** The settings (presentational): what each one is set to, and about the app. */
@Component({
  selector: 'hrs-settings-form',
  imports: [MatSliderModule],
  templateUrl: './settings-form.html',
  styleUrl: './settings-form.scss',
})
export class SettingsForm {
  /** How many replays are imported at the same time. */
  readonly parallelImports = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  /** This device's default for parallel imports. */
  readonly deviceDefault = input.required<number>();
  /** This device's logical cores, when the browser reports them. */
  readonly cores = input<number | null>(null);
  /** The app's version. */
  readonly version = input.required<string>();
  /** What the app runs as. */
  readonly kind = input.required<'web' | 'desktop'>();
  /** The user chose how many replays to import at the same time. */
  readonly parallelImportsChange = output<number>();
}
