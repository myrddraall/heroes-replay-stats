import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A titled, iconed empty state, on a glass panel; pages use it until they have data to show. */
@Component({
  selector: 'hrs-empty-state',
  imports: [MatIconModule],
  template: `
    <section class="empty hrs-glass">
      <mat-icon class="material-symbols-outlined empty__icon" aria-hidden="true">{{
        icon()
      }}</mat-icon>
      <h2>{{ title() }}</h2>
      <p class="empty__text"><ng-content /></p>
    </section>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 8px;
      padding: 64px 16px;
    }
    .empty__icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: rgb(var(--hrs-glass-edge));
    }
    .empty__text {
      color: var(--mat-sys-on-surface-variant);
      max-width: 48ch;
      margin: 0;
    }
  `,
})
export class EmptyState {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
}
