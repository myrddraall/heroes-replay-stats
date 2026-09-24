import { inject } from '@angular/core';
import type { ReplayRecord } from '@myrddraall/heroprotocol-db/model';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { injectPlatform } from '../../platform/platform';
import type { PickedReplay } from '../../platform/platform';
import { REPLAY_DB } from './provide-replay-db';

/** Anything `import()` accepts besides "open the dialog". */
export type ReplayInput =
  | Uint8Array
  | ArrayBuffer
  | File
  | FileList
  | FileSystemFileHandle
  | PickedReplay
  | readonly (File | FileSystemFileHandle | PickedReplay)[];

export const ReplaysStore = signalStore(
  { providedIn: 'root' },
  withState({ replays: [] as ReplayRecord[] }),
  withMethods((store, db = inject(REPLAY_DB), platform = injectPlatform()) => {
    /** Ingest one replay; resolves when it is written and its background analysers have run. */
    async function ingest(
      bytes: Uint8Array | ArrayBuffer,
      fileName: string,
    ): Promise<ReplayRecord> {
      const { replay } = await db.ingest(bytes, { fileName }).complete;
      return replay;
    }

    async function toPicked(input: ReplayInput, fileName?: string): Promise<PickedReplay[]> {
      if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
        return [
          {
            name: fileName ?? 'replay.StormReplay',
            bytes: input instanceof Uint8Array ? input : new Uint8Array(input),
          },
        ];
      }
      const items: (File | FileSystemFileHandle | PickedReplay)[] =
        input instanceof FileList
          ? [...input]
          : Array.isArray(input)
            ? [...input]
            : [input as File | FileSystemFileHandle | PickedReplay];
      return Promise.all(
        items.map(async (item): Promise<PickedReplay> => {
          // `File` has a bytes() method, so test for it (and handles) before treating
          // the item as an already-picked replay.
          const file =
            item instanceof File ? item : 'getFile' in item ? await item.getFile() : undefined;
          if (file === undefined) return item as PickedReplay;
          return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
        }),
      );
    }

    return {
      /** Load the imported replays. */
      async list(): Promise<ReplayRecord[]> {
        const replays = await db.listReplays();
        patchState(store, { replays });
        return replays;
      },

      /**
       * Import replays. With no argument, opens the platform's file dialog; otherwise takes
       * replay bytes (`Uint8Array`/`ArrayBuffer`, with an optional file name), `File`s, a
       * `FileList`, `FileSystemFileHandle`s, or already-picked replays — singly or as arrays.
       * Resolves with the imported replays and refreshes `list()`.
       */
      async import(input?: ReplayInput, fileName?: string): Promise<ReplayRecord[]> {
        const picked =
          input === undefined ? await platform.pickReplays() : await toPicked(input, fileName);
        const imported: ReplayRecord[] = [];
        for (const file of picked) imported.push(await ingest(file.bytes, file.name));
        if (imported.length > 0) await this.list();
        return imported;
      },
    };
  }),
);
