import {
  afterRenderEffect,
  Component,
  type ElementRef,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import {
  allPois,
  type ElementShown,
  KIND_STATES,
  type Poi,
  type PoiTeam,
} from '@myrddraall/heroes-replay-stats-map';

const STATE_ICONS: Record<ElementShown, string> = {
  standing: 'fort',
  rubble: 'landslide',
  off: 'visibility_off',
  spawned: 'swords',
};

const STATE_LABELS: Record<ElementShown, string> = {
  standing: 'Standing',
  rubble: 'Rubble',
  off: 'Off',
  spawned: 'Spawned',
};

/**
 * The map's points of interest by team and, within a team, by group (presentational), each a
 * button; the picked one is pressed, and kept in view. The arrow keys pick the next or the
 * previous one, across the groups and teams. Beside each, an icon button shows what it is shown
 * as and steps it to the next state without picking it.
 */
@Component({
  selector: 'hrs-poi-list',
  templateUrl: './poi-list.html',
  styleUrl: './poi-list.scss',
  imports: [MatIcon],
  host: { '(keydown)': 'key($event)' },
})
export class PoiList {
  readonly teams = input.required<readonly PoiTeam[]>();
  readonly selected = input<string | null>(null);
  /** What each point of interest is shown as, by key. */
  readonly states = input<Readonly<Record<string, ElementShown>>>({});
  /** A point of interest was picked: its key. */
  readonly poiSelect = output<string>();
  /** A point of interest's toggle was pressed: its key (it should step to its next state). */
  readonly stateToggle = output<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('poi');

  constructor() {
    // The picked one scrolled into view, picked on the map or from here alike.
    afterRenderEffect(() => {
      const key = this.selected();
      const at = this.keys().indexOf(key ?? '');
      if (at >= 0) this.buttons()[at]?.nativeElement.scrollIntoView({ block: 'nearest' });
    });
  }

  protected stateIcon(state: ElementShown | undefined): string {
    return state ? STATE_ICONS[state] : '';
  }

  /** The toggle's name: what it shows now and what a press shows next. */
  protected toggleLabel(poi: Poi, state: ElementShown | undefined): string {
    if (!state) return `${poi.label}: show next state`;
    const states = KIND_STATES[poi.kind] as readonly ElementShown[];
    const next = states[(states.indexOf(state) + 1) % states.length] ?? state;
    return `${poi.label}: shown as ${STATE_LABELS[state]}, show ${STATE_LABELS[next]}`;
  }

  private keys(): string[] {
    return allPois(this.teams()).map((p) => p.key);
  }

  /** Up and down pick the previous and the next point of interest, and move focus to it. */
  protected key(e: KeyboardEvent): void {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    const keys = this.keys();
    if (!step || !keys.length) return;
    const current = keys.indexOf(this.selected() ?? '');
    const next =
      current < 0
        ? step > 0
          ? 0
          : keys.length - 1
        : Math.min(keys.length - 1, Math.max(0, current + step));
    e.preventDefault();
    this.poiSelect.emit(keys[next]);
    this.buttons()[next]?.nativeElement.focus();
  }
}
