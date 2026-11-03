import { Component, input } from '@angular/core';
import type { CheckTable } from '../../model';

/** One of the renderer check's tables (presentational). */
@Component({
  selector: 'hrs-check-table',
  templateUrl: './check-table.html',
  styleUrl: './check-table.scss',
})
export class CheckTableView {
  readonly table = input.required<CheckTable>();
}
