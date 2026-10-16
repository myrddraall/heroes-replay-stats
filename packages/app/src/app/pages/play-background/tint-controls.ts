import { Component, input, model, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import type { TintBlend } from '../../scenes/play-background/scene-tints';
import {
  BLENDS,
  PART_LABELS,
  PARTS,
  type Part,
  type PartTint,
  type TintPreset,
  type TintSettings,
} from './tint-settings';

/**
 * The background's tints to play with (presentational): presets for the whole of it, and for the
 * background and each planet a tint of its own, its colour and how it blends.
 */
@Component({
  selector: 'hrs-tint-controls',
  imports: [MatButton, MatFormField, MatLabel, MatOption, MatSelect, MatSlideToggle],
  templateUrl: './tint-controls.html',
  styleUrl: './tint-controls.scss',
})
export class TintControls {
  readonly settings = model.required<TintSettings>();
  readonly presets = input.required<readonly TintPreset[]>();
  readonly presetChosen = output<TintPreset>();

  protected readonly parts = PARTS;
  protected readonly labels = PART_LABELS;
  protected readonly blends = BLENDS;

  protected change(part: Part, change: Partial<PartTint>): void {
    this.settings.update((settings) => ({ ...settings, [part]: { ...settings[part], ...change } }));
  }

  protected colour(part: Part, event: Event): void {
    this.change(part, { colour: (event.target as HTMLInputElement).value });
  }

  protected blend(part: Part, blend: TintBlend): void {
    this.change(part, { blend });
  }
}
