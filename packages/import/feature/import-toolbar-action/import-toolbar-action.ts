import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ReplayImportJobStore } from '../../data';

/**
 * Importing, at the end of the shell's toolbar (container): the progress pod while imports run,
 * otherwise the button that starts one (an icon on a handset).
 */
@Component({
  selector: 'hrs-import-toolbar-action',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, RouterLink],
  templateUrl: './import-toolbar-action.html',
  styleUrl: './import-toolbar-action.scss',
})
export class ImportToolbarAction {
  protected readonly imports = inject(ReplayImportJobStore);
  /** The pod while imports are running; null when the plain button should show. */
  protected readonly importPod = computed(() => {
    const o = this.imports.overall();
    if (!o.active) return null;
    const percent = Math.round(o.progress * 100);
    return {
      percent,
      short: `${percent}%`,
      label: `Importing ${o.done + o.failed + o.running} of ${o.total} · ${percent}%`,
    };
  });
  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
}
