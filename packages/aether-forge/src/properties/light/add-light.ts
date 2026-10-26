import { Component, output } from '@angular/core';
import type { NewLightKind } from '@myrddraall/heroes-replay-stats-aether/lights';
import { LIGHT_ICONS } from '../../editing/model/lights';
import { SplitButton, type SplitOption } from '../../controls/split-button';

/** A light of each kind there is, as offered to add. */
const KINDS: readonly SplitOption[] = (
  [
    ['ambient', 'Ambient light'],
    ['directional', 'Directional light'],
    ['antilight', 'Antilight'],
    ['point', 'Point light'],
    ['spot', 'Spot light'],
    ['hemisphere', 'Hemisphere light'],
    ['environment', 'Environment light'],
    ['rim', 'Rim light'],
  ] as const
).map(([id, label]) => ({ id, label, icon: LIGHT_ICONS[id] }));

/**
 * The button to add a light (presentational): of each kind (from all round, from a side, or an
 * antilight: from a side, darkening; its arrow choosing), to what is selected (a body, the
 * scene); in the section of its lights.
 */
@Component({
  selector: 'forge-add-light',
  imports: [SplitButton],
  templateUrl: './add-light.html',
  styleUrl: '../../panel/properties-panel.scss',
})
export class AddLight {
  readonly added = output<NewLightKind>();
  protected readonly kinds = KINDS;

  protected add(id: string): void {
    this.added.emit(id as NewLightKind);
  }
}
