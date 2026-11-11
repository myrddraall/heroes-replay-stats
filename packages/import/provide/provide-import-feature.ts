import { inject, type Provider } from '@angular/core';
import { ROUTES } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import {
  provideShellFileDrop,
  provideShellMenuAction,
  provideShellSection,
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
 * Importing in an app: the replay database and its ingest workers, the Import page (the Replays
 * area's last section), the top bar's import pod (the way to it, and the progress while imports
 * run), .StormReplay files dropped on the page, and the settings menu's entry that clears all match
 * data. List it before `provideRouter`.
 */
export function provideImportFeature(): Provider[] {
  return [
    { provide: REPLAY_DB, useFactory: createReplayDbClient },
    { provide: REPLAY_DB_FACTORY, useValue: createReplayDbClient },
    { provide: ROUTES, multi: true, useValue: IMPORT_ROUTES },
    provideShellToolbarAction(ImportToolbarAction),
    // the pod's page, the Replays area's last section
    provideShellSection({ area: '/replays', label: 'Import', link: '/replays/import', order: 40 }),
    // asks first; its dialog is loaded when it is first opened
    provideShellMenuAction(() => {
      const dialog = inject(MatDialog);
      return {
        label: 'Clear match data…',
        order: 90,
        run: () =>
          void import('../feature/clear-match-data-dialog').then((m) =>
            dialog.open(m.ClearMatchDataDialog, { width: '28rem' }),
          ),
      };
    }),
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
