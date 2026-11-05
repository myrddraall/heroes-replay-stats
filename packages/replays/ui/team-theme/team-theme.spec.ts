import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Team } from '@myrddraall/heroprotocol-db';
import { describe, expect, it } from 'vitest';
import { TeamPerspective } from './team-perspective';
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

function themes(el: HTMLElement): (string | null)[] {
  return [...el.querySelectorAll('div')].map((d) => d.getAttribute('theme'));
}

describe('TeamTheme', () => {
  it('uses the fixed colours without a perspective, and no theme for a null team', async () => {
    const fixture = TestBed.createComponent(Rows);
    await fixture.whenStable();
    expect(themes(fixture.nativeElement)).toEqual(['blue', 'red', null]);
  });

  it("follows the perspective's team and mode", async () => {
    const fixture = TestBed.createComponent(Screen);
    const perspective = fixture.debugElement.injector.get(TeamPerspective);
    await fixture.whenStable();
    expect(themes(fixture.nativeElement)).toEqual(['blue', 'red', null]);

    perspective.follow(signal(1));
    await fixture.whenStable();
    expect(themes(fixture.nativeElement)).toEqual(['red', 'blue', null]);

    perspective.mode.set('fixed');
    await fixture.whenStable();
    expect(themes(fixture.nativeElement)).toEqual(['blue', 'red', null]);
  });
});
