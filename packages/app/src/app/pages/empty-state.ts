import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A titled, iconed empty state; pages use it until they have data to show. */
@Component({
  selector: 'hrs-empty-state',
  imports: [MatIconModule],
  template: `
    <section class="empty">
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
      border: 1px dashed var(--hrs-border);
      border-radius: 16px;
      background: rgba(14, 21, 38, 0.6);
    }
    .empty__icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: var(--hrs-gold-dim);
    }
    .empty__text {
      color: var(--mat-sys-on-surface-variant);
      max-width: 48ch;
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
}
