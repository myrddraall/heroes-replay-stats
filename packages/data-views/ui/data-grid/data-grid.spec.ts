import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { GridSort } from '../../model';
import { provideWholeLists } from '../../testing';
import { CellTemplate, GridColumn } from './grid-column';
import { DataGrid } from './data-grid';

interface Player {
  readonly name: string;
  readonly kills: number;
  readonly team: string;
}

@Component({
  imports: [DataGrid, GridColumn, CellTemplate],
  template: `<hrs-data-grid [items]="players" [rowTheme]="themeOf" [(sort)]="sort" sortStart="desc">
    <hrs-column name="name" header="Player" />
    <hrs-column name="kills" header="Kills" align="end" sortable>
      <ng-template hrsCell let-player>{{ player.kills }} kills</ng-template>
    </hrs-column>
  </hrs-data-grid>`,
})
class Host {
  readonly players: readonly Player[] = [
    { name: 'Li Li', kills: 3, team: 'blue' },
    { name: 'Genji', kills: 7, team: 'red' },
  ];
  readonly sort = signal<GridSort | null>(null);
  readonly themeOf = (p: Player) => p.team;
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideWholeLists()] });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DataGrid', () => {
  it('draws a header per column and a row per item, as a table', async () => {
    const { el } = await render();
    const grid = el.querySelector('hrs-data-grid')!;
    expect(grid.getAttribute('role')).toBe('table');
    expect(grid.getAttribute('aria-rowcount')).toBe('3');
    const headers = [...el.querySelectorAll('.hrs-grid__head [role="columnheader"]')];
    expect(headers.map((h) => h.textContent!.trim())).toEqual(['Player', 'Kills']);
    const rows = [...el.querySelectorAll('.hrs-grid__body [role="row"]')];
    expect(rows.map((r) => [...r.children].map((c) => c.textContent!.trim()))).toEqual([
      ['Li Li', '3 kills'],
      ['Genji', '7 kills'],
    ]);
    expect(rows.map((r) => r.getAttribute('data-theme'))).toEqual(['blue', 'red']);
    expect(rows[0]!.children[0]!.getAttribute('role')).toBe('rowheader');
    expect(rows[0]!.children[1]!.classList.contains('hrs-num')).toBe(true);
  });

  it('sorts by a sortable header pressed, its first press in the grid\'s first direction', async () => {
    const { fixture, el } = await render();
    const kills = el.querySelectorAll<HTMLElement>('.hrs-grid__head [role="columnheader"]')[1]!;
    kills.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.sort()).toEqual({ column: 'kills', direction: 'desc' });
    expect(kills.getAttribute('aria-sort')).toBe('descending');
    const player = el.querySelectorAll<HTMLElement>('.hrs-grid__head [role="columnheader"]')[0]!;
    player.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.sort()).toEqual({ column: 'kills', direction: 'desc' });
  });
});
