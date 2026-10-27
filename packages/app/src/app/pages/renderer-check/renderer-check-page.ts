import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DevReports } from '../../platform/dev-reports';
import { RENDERER } from "@myrddraall/heroes-replay-stats-aether/render";
import { SceneView } from "@myrddraall/heroes-replay-stats-aether/view";
import { CheckControls } from './check-controls';
import { CheckDifference } from './check-difference';
import { CheckPictures } from './check-pictures';
import { CheckTableView, tableText } from './check-table';
import { RendererCheckStore } from './renderer-check.store';

/**
 * The renderer check (container): its store runs the steps (the background drawn by three.js on
 * each of its backends, every shader compiled cold, then both compared); the page passes what it
 * finds to the controls, the pictures and the tables, and copies the tables when asked. Its
 * results, as they come, go where dev reports go too (`DevReports`: read where the app is
 * developed).
 */
@Component({
  selector: 'hrs-renderer-check-page',
  imports: [SceneView, CheckControls, CheckPictures, CheckTableView, CheckDifference],
  templateUrl: './renderer-check-page.html',
  styleUrl: './renderer-check-page.scss',
  providers: [
    RendererCheckStore,
    {
      provide: RENDERER,
      useFactory: (check: InstanceType<typeof RendererCheckStore>) => computed(() => check.factory),
      deps: [RendererCheckStore],
    },
  ],
})
export class RendererCheckPage {
  protected readonly check = inject(RendererCheckStore);
  protected readonly copyLabel = signal('Copy results');
  private readonly reports = inject(DevReports);

  constructor() {
    effect(() => {
      const phase = this.check.phase();
      const step = this.check.step();
      const text = this.check.tables().map(tableText).join('\n\n');
      if (phase === 'idle') return;
      const status = phase === 'done' ? 'Done.' : `Running: ${step ?? 'the next step'}`;
      untracked(() =>
        this.reports.send('renderer-check', `${status}\n\n${text}`, phase === 'done'),
      );
    });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.check.tables().map(tableText).join('\n\n'));
      this.copyLabel.set('Copied');
    } catch {
      this.copyLabel.set('Copy failed');
    }
    setTimeout(() => this.copyLabel.set('Copy results'), 2000);
  }
}
