import { Component, input } from '@angular/core';
import type { HeroIcon } from '../../data/heroes/hero-lookup';
import { HeroMinimapIcon } from '../../heroes/hero-minimap-icon';

/** A player at the start of a stats row: their hero's icon, the hero and their name. */
@Component({
  selector: 'hrs-player-cell',
  imports: [HeroMinimapIcon],
  templateUrl: './player-cell.html',
  styleUrl: './player-cell.scss',
})
export class PlayerCell {
  readonly hero = input.required<string>();
  readonly name = input.required<string>();
  readonly icon = input<HeroIcon | null>(null);
}
