import { Directive, inject, input, TemplateRef } from '@angular/core';
import type { StatRow } from '../../model';

export interface StatRowHeadContext<T> {
  /** The row's `data`. */
  readonly $implicit: T;
  readonly row: StatRow<T>;
}

/**
 * What a stat table shows at the start of each row (who the row is), placed inside the table:
 * `<ng-template [uiStatRowHead]="rows" let-player>…</ng-template>`. The rows are given only so
 * the template's `let-` variables know their type.
 */
@Directive({ selector: 'ng-template[uiStatRowHead]' })
export class StatRowHead<T> {
  readonly uiStatRowHead = input.required<readonly StatRow<T>[]>();
  readonly template = inject<TemplateRef<StatRowHeadContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StatRowHead<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- a type guard names what it guards
    _ctx: unknown,
  ): _ctx is StatRowHeadContext<T> {
    return true;
  }
}
