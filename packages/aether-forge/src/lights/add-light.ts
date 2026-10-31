import { Component, output } from '@angular/core';
import { LIGHT_KIND_NAMES, type LightKind } from '@myrddraall/heroes-replay-stats-aether/lights';
import { LIGHT_ICONS } from './lights';
import { SplitButton, type SplitOption } from '../controls/split-button';

/** A light of each kind there is, as offered to add. */
const KINDS: readonly SplitOption[] = (
  [
    'ambient',
    'directional',
    'point',
    'spot',
    'hemisphere',
    'environment',
    'rim',
  ] as const satisfies readonly LightKind[]
).map((id) => ({ id, label: LIGHT_KIND_NAMES[id], icon: LIGHT_ICONS[id] }));

/**
 * The button to add a light (presentational): of each kind (from all round, from a side, from a
 * point; its arrow choosing), to what is selected (a body, the scene); in the section of its
 * lights. Any of them can darken instead (its Effect).
 */
@Component({
  selector: 'forge-add-light',
  imports: [SplitButton],
  templateUrl: './add-light.html',
  styleUrl: '../panel/properties-panel.scss',
})
export class AddLight {
  readonly added = output<LightKind>();
  protected readonly kinds = KINDS;

  protected add(id: string): void {
    this.added.emit(id as LightKind);
  }
}
