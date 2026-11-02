import { inject, type Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import {
  provideShellFileDrop,
  provideShellNavItem,
  provideShellToolbarAction,
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
 * Importing in an app: the replay database and its ingest workers, the Import page and its nav
 * item, the toolbar's import button (the progress while imports run), and .StormReplay files
 * dropped on the page. List it before `provideRouter`.
 */
export function provideImportFeature(): Provider[] {
  return [
    { provide: REPLAY_DB, useFactory: createReplayDbClient },
    { provide: REPLAY_DB_FACTORY, useValue: createReplayDbClient },
    { provide: ROUTES, multi: true, useValue: IMPORT_ROUTES },
    provideShellNavItem({ path: '/import', label: 'Import', icon: 'upload_file', order: 40 }),
    provideShellToolbarAction(ImportToolbarAction),
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
