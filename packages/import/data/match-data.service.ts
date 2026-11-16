import { DOCUMENT, inject, Service } from '@angular/core';
import { DEFAULT_DB_NAME } from '@myrddraall/heroprotocol-db/db';
import { Dexie } from 'dexie';
import { REPLAY_DB } from './replay-db';
import { ReplayImportJobStore } from './replay-import-job.store';

/** Everything stored about matches: the imported replays and what was worked out from them. */
@Service()
export class MatchDataService {
  private readonly db = inject(REPLAY_DB);
  private readonly imports = inject(ReplayImportJobStore);
  private readonly document = inject(DOCUMENT);

  /**
   * Deletes every stored replay with its stats, and empties the import list (queued imports never
   * start). Settings stay. The replay database itself is deleted, not its rows: emptying the
   * tables holds one write over all of them for as long as it takes (minutes on a large database),
   * every page's reads and every import waiting behind it. The app's own connections are closed
   * first (other tabs' close themselves when asked), and the app starts again afterwards, on a
   * new, empty database.
   */
  async clear(): Promise<void> {
    for (const job of this.imports.entities()) this.imports.dismiss(job.id);
    // without waiting for the database to be ready: it clears one that is stuck, too
    await this.db.close();
    await Dexie.delete(DEFAULT_DB_NAME);
    this.document.location.reload();
  }
}
