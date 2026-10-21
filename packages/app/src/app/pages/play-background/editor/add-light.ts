import { Component, computed, input, output } from '@angular/core';
import type { NewLightKind } from '../../../scenes/play-background/scene-lights';
import { LIGHT_ICONS } from './editor-model';
import { SplitButton, type SplitOption } from './split-button';

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
  ] as const
).map(([id, label]) => ({ id, label, icon: LIGHT_ICONS[id] }));

/**
 * The button to add a light (presentational): of each kind (from all round, from a side, or an
 * antilight: from a side, darkening; its arrow choosing), to what is selected (a body, the
 * scene); in the section of its lights.
 */
@Component({
  selector: 'hrs-add-light',
  imports: [SplitButton],
  templateUrl: './add-light.html',
  styleUrl: './properties-panel.scss',
})
export class AddLight {
  readonly added = output<NewLightKind>();
  /** The kinds offered (none given: every kind). */
  readonly only = input<readonly NewLightKind[] | null>(null);
  protected readonly kinds = computed(() => {
    const only = this.only();
    return only ? KINDS.filter((k) => only.includes(k.id as NewLightKind)) : KINDS;
  });

  protected add(id: string): void {
    this.added.emit(id as NewLightKind);
  }
}
