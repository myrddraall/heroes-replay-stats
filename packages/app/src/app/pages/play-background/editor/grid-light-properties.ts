import { Component, computed, input, output } from '@angular/core';
import { gridLightValues } from '../../../scenes/play-background/material-settings';
import type { GridLight } from '../../../scenes/play-background/scene-planets';
import { PropertyCheck } from '../properties/property-check';
import { PropertyDirection } from '../properties/property-direction';
import { PropertyNumber } from '../properties/property-number';
import { type PropertyOption, PropertySelect } from '../properties/property-select';
import { PropertySection } from '../properties/property-section';
import { PropertyText } from '../properties/property-text';

/** What a shield light does to the grid, as its Effect list offers it. */
const EFFECTS: readonly PropertyOption[] = [
  { value: 'lights', label: 'Lights' },
  { value: 'darkens', label: 'Darkens' },
];

/**
 * One of a shield shader's lights (presentational), its own: its name; as a light, whether it
 * lights or darkens (hides and deactivates), how strong, and (one from a side) where it comes from,
 * how far round the face it reaches and how softly; and what it does to the grid: reveals it,
 * activates it (energizing and glowing so much there), either or both. Whether it is on is its
 * row's checkbox in the tree.
 */
@Component({
  selector: 'hrs-grid-light-properties',
  imports: [
    PropertySection,
    PropertyText,
    PropertySelect,
    PropertyNumber,
    PropertyDirection,
    PropertyCheck,
  ],
  templateUrl: './grid-light-properties.html',
  styleUrl: './properties-panel.scss',
})
export class GridLightProperties {
  readonly light = input.required<GridLight>();
  readonly lightChange = output<Partial<GridLight>>();
  /** It was taken out of the shader's lights. */
  readonly removed = output<void>();

  protected readonly effects = EFFECTS;
  /** Its settings in effect. */
  protected readonly values = computed(() => gridLightValues(this.light()));

  /** Renamed (left empty: kept as it was). */
  protected rename(value: string): void {
    const name = value.trim();
    if (name) this.lightChange.emit({ name });
  }
}
