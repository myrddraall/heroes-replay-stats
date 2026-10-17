import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ElementShown, PoiTeam } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import { PoiList } from './poi-list';

const teams: readonly PoiTeam[] = [
  {
    id: 'order',
    label: 'Order',
    owner: 'order',
    groups: [
      {
        id: 'town-1',
        label: 'Town 1',
        owner: 'order',
        pois: [
          {
            key: 'structure-1',
            kind: 'structure',
            label: 'Fort',
            type: 'TownTownHallL2',
            cell: [10, 20.4],
            layer: 'map',
            owner: 'order',
            town: 1,
            outpost: null,
            core: false,
          },
        ],
      },
      {
        id: 'outpost-1',
        label: 'Outpost 1',
        owner: 'order',
        pois: [
          {
            key: 'structure-2',
            kind: 'structure',
            label: 'Tower',
            type: 'TownCannonTowerL3Standalone',
            cell: [12, 40],
            layer: 'map',
            owner: 'order',
            town: 1,
            outpost: 1,
            core: false,
          },
        ],
      },
    ],
  },
  {
    id: 'neutral',
    label: 'Neutral',
    owner: null,
    groups: [
      {
        id: 'camps',
        label: 'Mercenary camps',
        owner: null,
        pois: [
          {
            key: 'camp-1',
            kind: 'camp',
            label: 'Siege camp',
            type: 'SiegeCamp1',
            cell: [50, 50],
            layer: 'map',
            owner: null,
            town: null,
            outpost: null,
            core: false,
          },
        ],
      },
    ],
  },
];

@Component({
  imports: [PoiList],
  template: `<hrs-poi-list
    [teams]="teams"
    [selected]="selected()"
    [states]="states()"
    (poiSelect)="picked.set($event)"
    (stateToggle)="toggled.set($event)"
  />`,
})
class Host {
  readonly teams = teams;
  readonly selected = signal<string | null>('structure-2');
  readonly picked = signal<string | null>(null);
  readonly states = signal<Record<string, ElementShown>>({
    'structure-1': 'standing',
    'structure-2': 'rubble',
    'camp-1': 'spawned',
  });
  readonly toggled = signal<string | null>(null);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('the list of points of interest', () => {
  it('shows each team, its groups under it, and a button per point, the picked one pressed', async () => {
    const { el } = await render();
    expect([...el.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Order', 'Neutral']);
    expect([...el.querySelectorAll('h4')].map((h) => h.textContent)).toEqual([
      'Town 1',
      'Outpost 1',
      'Mercenary camps',
    ]);
    expect(
      [...el.querySelectorAll('.pois__team--order h4')].map((h) => h.textContent),
    ).toEqual(['Town 1', 'Outpost 1']);
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button.poi')];
    expect(buttons.map((b) => b.querySelector('.poi__label')!.textContent)).toEqual([
      'Fort',
      'Tower',
      'Siege camp',
    ]);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(buttons[0].classList.contains('poi--order')).toBe(true);
  });

  it("shows each point's state on its toggle, and reports a press without picking it", async () => {
    const { fixture, el } = await render();
    const toggles = [...el.querySelectorAll<HTMLButtonElement>('button.poi-toggle')];
    expect(toggles.map((t) => t.textContent!.trim())).toEqual(['fort', 'landslide', 'swords']);
    expect(toggles[1].getAttribute('aria-label')).toBe('Tower: shown as Rubble, show Off');
    expect(toggles[2].getAttribute('aria-label')).toBe('Siege camp: shown as Spawned, show Off');
    toggles[0].click();
    expect(fixture.componentInstance.toggled()).toBe('structure-1');
    expect(fixture.componentInstance.picked()).toBeNull();
    fixture.componentInstance.states.update((s) => ({ ...s, 'structure-1': 'off' }));
    await fixture.whenStable();
    expect(toggles[0].textContent!.trim()).toBe('visibility_off');
  });

  it('reports the point picked', async () => {
    const { fixture, el } = await render();
    el.querySelectorAll<HTMLButtonElement>('button.poi')[2].click();
    expect(fixture.componentInstance.picked()).toBe('camp-1');
  });

  it('picks the next and the previous point with the arrow keys, and moves focus to it', async () => {
    const { fixture, el } = await render(); // structure-2 is picked
    const list = el.querySelector('hrs-poi-list')!;
    const press = (key: string) =>
      list.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    press('ArrowDown');
    expect(fixture.componentInstance.picked()).toBe('camp-1');
    expect(document.activeElement?.textContent?.trim()).toBe('Siege camp');
    fixture.componentInstance.selected.set('camp-1');
    await fixture.whenStable();
    press('ArrowDown'); // the last one stays
    expect(fixture.componentInstance.picked()).toBe('camp-1');
    press('ArrowUp');
    expect(fixture.componentInstance.picked()).toBe('structure-2');
  });
});
