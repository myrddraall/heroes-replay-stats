import { Component, inject } from '@angular/core';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  defaultParallelImports,
  deviceCores,
  MAX_PARALLEL_IMPORTS,
  MIN_PARALLEL_IMPORTS,
  SettingsStore,
} from '../../data/settings/settings.store';
import { injectPlatform } from '../../platform/platform';

@Component({
  selector: 'hrs-settings-page',
  imports: [MatSliderModule, MatSlideToggleModule],
  template: `
    <h1>Settings</h1>
    <section class="card">
      <h2>Importing</h2>
      <label class="setting" for="parallel-imports">
        <span>Parallel imports</span>
        <span class="setting__value">{{ settings.parallelImports() }}</span>
      </label>
      <mat-slider class="slider" [min]="min" [max]="max" step="1" discrete showTickMarks>
        <input
          id="parallel-imports"
          matSliderThumb
          [value]="settings.parallelImports()"
          (valueChange)="settings.setParallelImports($event)"
        />
      </mat-slider>
      <p class="hint">
        How many replays are imported at the same time, each in its own worker. More is faster on a
        machine with many cores but uses more memory. The default for this device is
        {{ deviceDefault }}{{ cores ? ', a quarter of its ' + cores + ' cores' : '' }}.
      </p>
    </section>
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
    .setting {
      display: flex;
      justify-content: space-between;
      font: var(--mat-sys-body-large);
    }
    .setting__value {
      color: var(--hrs-bronze);
      font-variant-numeric: tabular-nums;
    }
    .slider {
      width: 100%;
      max-width: 480px;
    }
    .hint {
      color: var(--mat-sys-on-surface-variant);
      margin: 8px 0 0;
    }
  `,
})
export class SettingsPage {
  protected readonly platform = injectPlatform();
  protected readonly settings = inject(SettingsStore);
  protected readonly min = MIN_PARALLEL_IMPORTS;
  protected readonly max = MAX_PARALLEL_IMPORTS;
  protected readonly cores = deviceCores() ?? null;
  protected readonly deviceDefault = defaultParallelImports(deviceCores());
}
