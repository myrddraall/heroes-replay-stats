import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import type { ElementShown } from '@myrddraall/heroes-replay-stats-map';
import type { SelectedPoi } from './map-explore.store';

const STATE_LABELS: Record<ElementShown, string> = {
  standing: 'Standing',
  rubble: 'Rubble',
  off: 'Off',
  spawned: 'Spawned',
};

const OWNER_LABELS = { order: 'Order', chaos: 'Chaos' } as const;

/**
 * The picked point of interest (presentational): its facts, a split button for what it shows
 * (the button steps to the next state; its arrow opens a menu of them all); a hint when nothing
 * is picked. The pick is cleared on the map (a click on empty ground).
 */
@Component({
  selector: 'hrs-poi-details',
  imports: [MatIcon, MatMenu, MatMenuItem, MatMenuTrigger],
  templateUrl: './poi-details.html',
  styleUrl: './poi-details.scss',
})
export class PoiDetails {
  readonly poi = input<SelectedPoi | null>(null);
  /** The pick should show this state. */
  readonly stateChange = output<ElementShown>();

  protected stateLabel(state: ElementShown): string {
    return STATE_LABELS[state];
  }

  /** The state after the current one, round the kind's states. */
  protected nextState(p: SelectedPoi): ElementShown {
    const at = p.states.indexOf(p.state);
    return p.states[(at + 1) % p.states.length] ?? p.state;
  }

  protected ownerLabel(owner: 'order' | 'chaos' | null): string {
    return owner ? OWNER_LABELS[owner] : 'Neither side';
  }

  protected cellLabel([x, y]: readonly [number, number]): string {
    return `${Math.round(x)}, ${Math.round(y)}`;
  }
}
