import { inject, type Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import {
  provideShellFileDrop,
  provideShellToolbarAction,
  provideShellUtilityLink,
} from '@myrddraall/heroes-replay-stats-shell/ui';
import {
  createReplayDbClient,
  REPLAY_DB,
  REPLAY_DB_FACTORY,
  ReplayImportJobStore,
} from '../data';
import { ImportToolbarAction } from '../feature/import-toolbar-action';
import { IMPORT_ROUTES } from './routes';

/**
 * Importing in an app: the replay database and its ingest workers, the Import page, the top bar's
 * import pod (the way to it, and the progress while imports run), and .StormReplay files
 * dropped on the page. List it before `provideRouter`.
 */
export function provideImportFeature(): Provider[] {
  return [
    { provide: REPLAY_DB, useFactory: createReplayDbClient },
    { provide: REPLAY_DB_FACTORY, useValue: createReplayDbClient },
    { provide: ROUTES, multi: true, useValue: IMPORT_ROUTES },
    provideShellToolbarAction(ImportToolbarAction),
    // the pod's page, in the handset's tree (the pod has no room there)
    provideShellUtilityLink({ label: 'Import', link: '/import', order: 10 }),
    provideShellFileDrop(() => {
      const imports = inject(ReplayImportJobStore);
      return {
        label: 'Drop .StormReplay files to import them',
        icon: 'upload_file',
        accepts: (file) => /\.stormreplay$/i.test(file.name),
        drop: (files) => void imports.import(files),
      };
    }),
  ];
}
