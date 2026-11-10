import { inject, Service } from '@angular/core';
import { REPLAY_DB } from './replay-db';
import { ReplayImportJobStore } from './replay-import-job.store';

/** Everything stored about matches: the imported replays and what was worked out from them. */
@Service()
export class MatchDataService {
  private readonly db = inject(REPLAY_DB);
  private readonly imports = inject(ReplayImportJobStore);

  /**
   * Deletes every stored replay with its stats, and empties the import list (queued imports never
   * start). Settings stay. Every page showing matches or players empties as it goes.
   */
  async clear(): Promise<void> {
    for (const job of this.imports.entities()) this.imports.dismiss(job.id);
    await this.db.pruneReplays(0);
    // the database's own log of the imports that brought them in
    await this.db.db.ingestJobs.clear();
  }
}
