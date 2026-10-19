import { Component, computed, input, output } from '@angular/core';
import { PropertyCheck } from '../properties/property-check';
import { PropertySection } from '../properties/property-section';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertySlider } from '../properties/property-slider';
import type { ReferenceMode } from './editing-aids.store';

/** The reference image's settings, as its properties show them. */
export interface ReferenceValues {
  readonly shown: boolean;
  readonly mode: ReferenceMode;
  readonly amount: number;
  readonly scale: number;
  readonly across: number;
  readonly up: number;
}

/**
 * The reference image's properties (presentational): the image (chosen from this computer, or
 * taken away), whether it is shown, how it is laid over the view (split past a line, or faded)
 * and how much, and how it is fitted to the view (its size and where its middle is).
 */
@Component({
  selector: 'hrs-reference-properties',
  imports: [PropertySection, PropertyCheck, PropertySelect, PropertySlider],
  templateUrl: './reference-properties.html',
  styleUrl: './reference-properties.scss',
})
export class ReferenceProperties {
  /** The image's name; empty where none is chosen. */
  readonly name = input.required<string>();
  readonly hasImage = input.required<boolean>();
  readonly values = input.required<ReferenceValues>();
  /** Which settings differ from how they start. */
  readonly changed = input.required<Readonly<Record<keyof ReferenceValues, boolean>>>();
  readonly imageChosen = output<File>();
  readonly imageRemoved = output<void>();
  readonly valuesChange = output<Partial<ReferenceValues>>();
  /** Settings back as they start. */
  readonly clear = output<readonly (keyof ReferenceValues)[]>();

  protected readonly modes: readonly PropertyOption[] = [
    { value: 'split', label: 'Split' },
    { value: 'fade', label: 'Fade' },
  ];
  protected readonly amountLabel = computed(() =>
    this.values().mode === 'split' ? 'Split at' : 'Opacity',
  );
  protected readonly layChanged = computed(() => {
    const c = this.changed();
    return c.shown || c.mode || c.amount;
  });
  protected readonly fitChanged = computed(() => {
    const c = this.changed();
    return c.scale || c.across || c.up;
  });

  protected choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.imageChosen.emit(file);
    input.value = ''; // the same file can be chosen again
  }

  protected mode(value: string): void {
    if (value === 'split' || value === 'fade') this.valuesChange.emit({ mode: value });
  }
}
