import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
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

/** Whether a drag carries files (as opposed to text or links dragged within the page). */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/replays', label: 'Replays', icon: 'history' },
  { path: '/players', label: 'Players', icon: 'groups' },
  { path: '/maps', label: 'Maps', icon: 'map' },
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
  host: {
    '(document:dragenter)': 'onDragEnter($event)',
    '(document:dragover)': 'onDragOver($event)',
    '(document:dragleave)': 'onDragLeave($event)',
    '(document:drop)': 'onDrop($event)',
  },
})
export class Shell {
  /** True while files are being dragged over the page; shows the drop overlay. */
  protected readonly dragging = signal(false);
  /** dragenter/dragleave fire for every element crossed, so track nesting depth. */
  private dragDepth = 0;

  protected onDragEnter(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onDragLeave(event: DragEvent): void {
    if (!hasFiles(event)) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
      /\.stormreplay$/i.test(f.name),
    );
    if (files.length > 0) void this.imports.import(files);
  }
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
