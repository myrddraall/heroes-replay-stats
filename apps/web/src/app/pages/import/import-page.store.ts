import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { injectPlatform } from '../../platform/platform';

/** {@link ImportPage}'s component store: the import jobs, and where the app runs. */
export const ImportPageStore = signalStore(
  withProps(() => ({ _imports: inject(ReplayImportJobStore), _platform: injectPlatform() })),
  withComputed(({ _imports, _platform }) => ({
    jobs: _imports.jobs,
    overall: _imports.overall,
    desktop: computed(() => _platform.kind === 'desktop'),
  })),
  withMethods(({ _imports }) => ({
    /** Opens the file picker to import replays. */
    importReplays(): void {
      void _imports.import();
    },
    clearFinished(): void {
      _imports.clearFinished();
    },
    dismiss(id: string): void {
      _imports.dismiss(id);
    },
  })),
);
