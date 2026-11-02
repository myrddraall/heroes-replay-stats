import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Arena } from '@myrddraall/heroes-replay-stats-map';
import { describe, expect, it } from 'vitest';
import { MapViewControls } from './map-view-controls';

const arenas = ['M1', 'M2', 'M3'].map(
  (label, k) => ({ label, layer: { id: `map-m${k + 1}` } }) as unknown as Arena,
);

@Component({
  imports: [MapViewControls],
  template: `<hrs-map-view-controls
    [arenas]="arenas()"
    [arena]="arena()"
    [hasTeamColour]="hasTeamColour()"
    [teamColoursSwapped]="swapped()"
    (arenaChange)="chosen = $event"
    (teamColoursToggle)="toggles = toggles + 1"
  />`,
})
class Host {
  readonly arenas = signal<readonly Arena[]>(arenas);
  readonly arena = signal(0);
  readonly hasTeamColour = signal(true);
  readonly swapped = signal(false);
  chosen: number | null = null;
  toggles = 0;
}

async function render(set: (host: Host) => void = () => undefined) {
  const fixture = TestBed.createComponent(Host);
  set(fixture.componentInstance);
  await fixture.whenStable();
  return { el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, fixture };
}

describe('the map view controls', () => {
  it('offers the arenas of several and the team colour swap, and reports what is chosen', async () => {
    const { el, host, fixture } = await render();
    const radios = [...el.querySelectorAll<HTMLButtonElement>('.controls__arenas button')];
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['M1', 'M2', 'M3']);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    radios[2]?.click();
    await fixture.whenStable();
    expect(host.chosen).toBe(2);
    el.querySelector<HTMLButtonElement>('.controls__team')?.click();
    await fixture.whenStable();
    expect(host.toggles).toBe(1);
  });

  it('shows nothing for a map of one arena without team colour', async () => {
    const { el } = await render((h) => {
      h.arenas.set(arenas.slice(0, 1));
      h.hasTeamColour.set(false);
    });
    expect(el.querySelector('.controls')).toBeNull();
  });
});
