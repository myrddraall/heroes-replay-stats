import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideWholeLists } from '../../testing';
import { DataGrid } from '../data-grid/data-grid';
import { CellTemplate, GridColumn } from '../data-grid/grid-column';
import { GridRow } from './grid-row';

/** A cell that reads the row it is drawn in. */
@Component({
  selector: 'hrs-test-row-cell',
  template: '{{ row.index() }}:{{ row.theme() }}:{{ row.height() }}',
})
class RowCell {
  protected readonly row = inject(GridRow);
}

@Component({
  imports: [CellTemplate, DataGrid, GridColumn, RowCell],
  template: `<hrs-data-grid [items]="items" [rowTheme]="themeOf">
    <hrs-column name="name" header="Name" />
    <hrs-column name="row" header="Row">
      <hrs-test-row-cell *hrsCell />
    </hrs-column>
  </hrs-data-grid>`,
})
class Host {
  readonly items = [{ name: 'you', theme: 'blue-self' }, { name: 'them', theme: 'red' }];
  readonly themeOf = (item: { theme: string }) => item.theme;
}

describe('GridRow', () => {
  it('draws each row as a row component with its theme, and tells its cells where they are', async () => {
    TestBed.configureTestingModule({ providers: [provideWholeLists()] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('hrs-grid-row')];
    expect(rows.map((r) => [r.getAttribute('role'), r.classList.contains('hrs-grid__row')])).toEqual([
      ['row', true],
      ['row', true],
    ]);
    expect(rows.map((r) => r.getAttribute('theme'))).toEqual(['blue-self', 'red']);
    // every other row, by its place
    expect(rows.map((r) => r.classList.contains('hrs-grid__row--alternate'))).toEqual([false, true]);
    // a cell declared in the page's template still reaches the row it is drawn in
    expect(rows.map((r) => r.querySelector('hrs-test-row-cell')!.textContent)).toEqual([
      '0:blue-self:40',
      '1:red:40',
    ]);
  });
});
