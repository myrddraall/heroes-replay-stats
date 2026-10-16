import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ElementShown } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import type { SelectedPoi } from './map-explore.store';
import { PoiDetails } from './poi-details';

const fort: SelectedPoi = {
  poi: {
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
  state: 'standing',
  states: ['standing', 'rubble', 'off'],
};

@Component({
  imports: [PoiDetails],
  template: `<hrs-poi-details [poi]="poi()" (stateChange)="state.set($event)" />`,
})
class Host {
  readonly poi = signal<SelectedPoi | null>(fort);
  readonly state = signal<ElementShown | null>(null);
}

async function render(poi: SelectedPoi | null) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.poi.set(poi);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('the picked point of interest', () => {
  it('shows its facts and the state it shows', async () => {
    const { el } = await render(fort);
    expect(el.querySelector('.details__name')!.textContent).toBe('Fort');
    const facts = [...el.querySelectorAll('dd')].map((d) => d.textContent);
    expect(facts).toEqual(['Order', '1', '10, 20', 'TownTownHallL2']);
    expect(el.querySelector('.details__state-main')!.textContent!.trim()).toBe('Standing');
  });

  it('steps to the next state on a click, and offers them all from the arrow', async () => {
    const { fixture, el } = await render(fort);
    el.querySelector<HTMLButtonElement>('.details__state-main')!.click();
    expect(fixture.componentInstance.state()).toBe('rubble');
    el.querySelector<HTMLButtonElement>('.details__state-arrow')!.click();
    await fixture.whenStable();
    const items = [...document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')];
    expect(items.map((i) => i.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'check Standing',
      'Rubble',
      'Off',
    ]);
    items[2].click();
    expect(fixture.componentInstance.state()).toBe('off');
  });

  it('hints when nothing is picked', async () => {
    const { el } = await render(null);
    expect(el.querySelector('.details__hint')!.textContent).toContain('Click a structure or camp');
  });
});
