import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import {
  EmptyTemplate,
  GroupHeaderTemplate,
  ItemFocus,
  ItemList,
  ItemTemplate,
} from '@myrddraall/heroes-replay-stats-data-views/ui';
import { allPois, type ElementShown, KIND_STATES, type Poi, type PoiGroup, type PoiTeam } from '../../model';

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

/** A group's header: its team, shown over the team's first group (`top` over the first of all). */
interface PoiHead {
  readonly team: PoiTeam;
  readonly group: PoiGroup;
  readonly first: boolean;
  readonly top: boolean;
}

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
  imports: [EmptyTemplate, GroupHeaderTemplate, ItemFocus, ItemList, ItemTemplate, MatIcon],
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

  protected readonly pois = computed(() => allPois(this.teams()));
  protected readonly picked = computed(() => this.pois().find((p) => p.key === this.selected()) ?? null);

  /** Each group's header, by the group's key (`<team>/<group>`). */
  protected readonly heads = computed(() => {
    const heads = new Map<string, PoiHead>();
    this.teams().forEach((team, t) =>
      team.groups.forEach((group, g) =>
        heads.set(`${team.id}/${group.id}`, { team, group, first: g === 0, top: t === 0 && g === 0 }),
      ),
    );
    return heads;
  });

  /** Each point of interest's group key. */
  private readonly groupKeys = computed(() => {
    const keys = new Map<string, string>();
    for (const team of this.teams()) {
      for (const group of team.groups) for (const poi of group.pois) keys.set(poi.key, `${team.id}/${group.id}`);
    }
    return keys;
  });

  protected readonly byKey = (poi: Poi) => poi.key;
  protected readonly groupOf = (poi: Poi) => this.groupKeys().get(poi.key) ?? null;

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
}
