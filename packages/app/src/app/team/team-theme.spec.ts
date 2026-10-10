import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Team } from '@myrddraall/heroprotocol-db';
import { describe, expect, it } from 'vitest';
import { TeamPerspective } from './team-color';
import { TeamTheme } from './team-theme';

@Component({
  selector: 'hrs-rows',
  imports: [TeamTheme],
  template: `@for (t of teams; track $index) {
    <div [hrsTeam]="t"></div>
  }`,
})
class Rows {
  readonly teams: (Team | null)[] = [0, 1, null];
}

@Component({
  imports: [Rows],
  providers: [TeamPerspective],
  template: `<hrs-rows />`,
})
class Screen {}

function classes(el: HTMLElement): string[] {
  return [...el.querySelectorAll('div')].map((d) => d.className);
}

describe('TeamTheme', () => {
  it('uses the fixed colours without a perspective, and none for a null team', async () => {
    const fixture = TestBed.createComponent(Rows);
    await fixture.whenStable();
    expect(classes(fixture.nativeElement)).toEqual(['hrs-team-blue', 'hrs-team-red', '']);
  });

  it("follows the perspective's team and mode", async () => {
    const fixture = TestBed.createComponent(Screen);
    const perspective = fixture.debugElement.injector.get(TeamPerspective);
    await fixture.whenStable();
    expect(classes(fixture.nativeElement)).toEqual(['hrs-team-blue', 'hrs-team-red', '']);

    perspective.follow(signal(1));
    await fixture.whenStable();
    expect(classes(fixture.nativeElement)).toEqual(['hrs-team-red', 'hrs-team-blue', '']);

    perspective.mode.set('fixed');
    await fixture.whenStable();
    expect(classes(fixture.nativeElement)).toEqual(['hrs-team-blue', 'hrs-team-red', '']);
  });
});
