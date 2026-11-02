import { Component, input } from '@angular/core';

/** A table of the renderer check's results: its title, its columns' headings, its rows' cells. */
export interface CheckTable {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** A cell on one line, no tabs in it (a log's lines joined with bars), so the text stays a table. */
const flat = (s: string) => s.replace(/\s*[\t\r\n]+\s*/g, ' | ').trim();

/** A check table as tab-separated text (its title, headings, rows), to paste anywhere. */
export function tableText(table: CheckTable): string {
  return [
    flat(table.title),
    table.columns.map(flat).join('\t'),
    ...table.rows.map((r) => r.map(flat).join('\t')),
  ].join('\n');
}

/** One of the renderer check's tables (presentational). */
@Component({
  selector: 'hrs-check-table',
  templateUrl: './check-table.html',
  styleUrl: './check-table.scss',
})
export class CheckTableView {
  readonly table = input.required<CheckTable>();
}
