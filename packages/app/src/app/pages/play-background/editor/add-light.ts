import { Component, output } from '@angular/core';
import type { LightKind } from '../../../scenes/play-background/scene-lights';
import { LIGHT_ICONS } from './editor-model';
import { SplitButton, type SplitOption } from './split-button';

/** A light of each kind there is, as offered to add. */
const KINDS: readonly SplitOption[] = (
  [
    ['ambient', 'Ambient light'],
    ['directional', 'Directional light'],
    ['shadow', 'Antilight'],
  ] as const
).map(([id, label]) => ({ id, label, icon: LIGHT_ICONS[id] }));

/**
 * The button to add a light (presentational): of each kind (from all round, from a side, or
 * darkening from a side; its arrow choosing), to what is selected (a body, the scene); in the
 * section of its lights.
 */
@Component({
  selector: 'hrs-add-light',
  imports: [SplitButton],
  templateUrl: './add-light.html',
  styleUrl: './properties-panel.scss',
})
export class AddLight {
  readonly added = output<LightKind>();
  protected readonly kinds = KINDS;

  protected add(id: string): void {
    this.added.emit(id as LightKind);
  }
}
