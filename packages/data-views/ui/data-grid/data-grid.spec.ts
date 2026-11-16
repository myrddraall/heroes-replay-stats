import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { GridSort } from '../../model';
import { provideWholeLists } from '../../testing';
import { GridHeader } from '../grid-header/grid-header';
import { GridRowElement, RowTemplate } from '../grid-row/grid-row';
import { CellTemplate, GridColumn } from './grid-column';
import { DataGrid } from './data-grid';

interface Player {
  readonly name: string;
  readonly kills: number;
  readonly team: string;
}

@Component({
  imports: [DataGrid, GridColumn, CellTemplate, GridHeader, GridRowElement, RowTemplate],
  template: `<hrs-grid-header [for]="grid" />
    <hrs-data-grid
      #grid
      [items]="players"
      [rowTheme]="themeOf"
      [(sort)]="sort"
      [(displayedColumns)]="shown"
      sortStart="desc"
    >
      @if (themed()) {
        <hrs-grid-row *hrsRow />
      }
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
  readonly shown = signal<readonly string[] | null>(null);
  readonly themed = signal(true);
  readonly themeOf = (p: Player) => p.team;
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideWholeLists()] });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const cells = (row: Element) =>
  [...row.children].filter((c) => c.matches('[role="cell"], [role="rowheader"]'));

describe('DataGrid', () => {
  it('draws a row per item as a table, its header attached by reference and owned for screen readers', async () => {
    const { el } = await render();
    const grid = el.querySelector('hrs-data-grid')!;
    expect(grid.getAttribute('role')).toBe('table');
    expect(grid.getAttribute('aria-rowcount')).toBe('3');
    const head = el.querySelector('hrs-grid-header [role="row"]')!;
    expect(grid.getAttribute('aria-owns')).toBe(head.id);
    expect([...head.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent!.trim())).toEqual([
      'Player',
      'Kills',
    ]);
    const rows = [...grid.querySelectorAll('.hrs-grid__body [role="row"]')];
    expect(rows.map((r) => cells(r).map((c) => c.textContent!.trim()))).toEqual([
      ['Li Li', '3 kills'],
      ['Genji', '7 kills'],
    ]);
    expect(rows.map((r) => r.getAttribute('theme'))).toEqual(['blue', 'red']);
    expect(cells(rows[0]!)[0]!.getAttribute('role')).toBe('rowheader');
    expect(cells(rows[0]!)[1]!.classList.contains('hrs-num')).toBe(true);
  });

  it("gives its rows the look the page names, and none without one", async () => {
    const { fixture, el } = await render();
    const rows = () => [...el.querySelectorAll('hrs-data-grid .hrs-grid__body [role="row"]')];
    expect(rows().map((r) => r.classList.contains('hrs-grid__row'))).toEqual([true, true]);
    fixture.componentInstance.themed.set(false);
    await fixture.whenStable();
    expect(rows().map((r) => r.classList.contains('hrs-grid__row'))).toEqual([false, false]);
  });

  it('sorts through its header: a sortable column first in the grid\'s direction, then the other, then unsorted', async () => {
    const { fixture, el } = await render();
    const header = (i: number) => el.querySelectorAll<HTMLElement>('hrs-grid-header [role="columnheader"]')[i]!;
    const press = async (i: number) => {
      header(i).querySelector('button')?.click();
      await fixture.whenStable();
    };
    expect(header(0).querySelector('button')).toBeNull();
    expect(header(1).getAttribute('aria-sort')).toBe('none');
    await press(1);
    expect(fixture.componentInstance.sort()).toEqual({ column: 'kills', direction: 'desc' });
    expect(header(1).getAttribute('aria-sort')).toBe('descending');
    await press(1);
    expect(fixture.componentInstance.sort()).toEqual({ column: 'kills', direction: 'asc' });
    await press(1);
    expect(fixture.componentInstance.sort()).toBeNull();
  });

  it('shows the columns named, in their order, header and rows alike', async () => {
    const { fixture, el } = await render();
    fixture.componentInstance.shown.set(['kills', 'name']);
    await fixture.whenStable();
    const head = [...el.querySelectorAll('hrs-grid-header [role="columnheader"]')];
    expect(head.map((h) => h.textContent!.trim())).toEqual(['Kills', 'Player']);
    const row = el.querySelector('hrs-data-grid .hrs-grid__body [role="row"]')!;
    expect(cells(row).map((c) => c.textContent!.trim())).toEqual(['3 kills', 'Li Li']);
    fixture.componentInstance.shown.set(['name']);
    await fixture.whenStable();
    expect(el.querySelector('hrs-data-grid')!.getAttribute('aria-colcount')).toBe('1');
  });
});
