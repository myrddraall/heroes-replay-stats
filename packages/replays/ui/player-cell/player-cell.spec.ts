import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerCell } from './player-cell';

describe('PlayerCell', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(PlayerCell);
    fixture.componentRef.setInput('hero', 'Sonya');
    fixture.componentRef.setInput('name', 'Alice');
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    return {
      theme: el.getAttribute('theme'),
      names: [el.querySelector('.cell__hero')?.textContent, el.querySelector('.cell__player')?.textContent],
      you: el.querySelector('.cell__you')?.textContent ?? null,
    };
  }

  it("takes the theme around it without a team, its team's with one", async () => {
    expect(await render({})).toEqual({ theme: null, names: ['Sonya', 'Alice'], you: null });
    expect((await render({ team: 1 })).theme).toBe('red');
  });

  it("is the user's own on their side, said to screen readers", async () => {
    expect(await render({ team: 0, self: true })).toEqual({
      theme: 'blue-self',
      names: ['Sonya', 'Alice'],
      you: '(you)',
    });
    expect((await render({ team: 1, self: true })).theme).toBe('red-self');
  });
});
