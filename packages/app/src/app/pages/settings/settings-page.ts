import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { injectPlatform } from '../../platform/platform';

@Component({
  selector: 'hrs-settings-page',
  imports: [MatSlideToggleModule],
  template: `
    <h1>Settings</h1>
    <section class="card">
      <h2>Privacy</h2>
      <mat-slide-toggle [checked]="false" disabled
        >Keep the original replay files on this device</mat-slide-toggle
      >
      <p class="hint">
        Off by default: only the extracted statistics are stored. Wired up with the import step.
      </p>
    </section>
    <section class="card">
      <h2>About</h2>
      <p class="hint">
        Heroes Replay Stats {{ platform.version }} · running as {{ platform.kind }}. Everything
        stays on this device; there is no account and no server.
      </p>
    </section>
  `,
  styles: `
    .card {
      padding: 20px;
      margin-bottom: 16px;
      border: 1px solid var(--hrs-border);
      border-radius: 16px;
      background: rgba(22, 15, 58, 0.6);
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
      margin: 8px 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly platform = injectPlatform();
}
