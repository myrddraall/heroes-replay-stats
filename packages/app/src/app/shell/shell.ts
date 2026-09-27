import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ReplayImportJobStore } from '../data/import/replay-import-job.store';
import { injectPlatform } from '../platform/platform';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/replays', label: 'Replays', icon: 'history' },
  { path: '/players', label: 'Players', icon: 'groups' },
  { path: '/import', label: 'Import', icon: 'upload_file' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

/** The frame: a toolbar, a rail/sidenav that collapses on small screens, and the routed page. */
@Component({
  selector: 'hrs-shell',
  imports: [
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgOptimizedImage,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly platform = injectPlatform();
  protected readonly imports = inject(ReplayImportJobStore);
  protected readonly items = NAV_ITEMS;
  /** The toolbar pod while imports are running; null when the plain button should show. */
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
