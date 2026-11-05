import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ReplayImportJobStore } from '../../data';

/**
 * Importing, in the shell's utility cluster (smart): the theme's UtilityPod, a link to the imports
 * (their progress while they run, the percentage alone on a handset) with a "+" that starts one.
 */
@Component({
  selector: 'hrs-import-toolbar-action',
  imports: [MatIconModule, MatTooltipModule, RouterLink],
  templateUrl: './import-toolbar-action.html',
  styleUrl: './import-toolbar-action.scss',
})
export class ImportToolbarAction {
  protected readonly imports = inject(ReplayImportJobStore);
  /** The progress while imports are running; null when none are. */
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
