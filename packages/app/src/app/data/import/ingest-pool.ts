import { inject, Service } from '@angular/core';
import type { ReplayDbClient } from '@myrddraall/heroprotocol-db/client';
import { REPLAY_DB, REPLAY_DB_FACTORY } from './provide-replay-db';

/** A worker lent to one import; hand it back with `IngestPool.release()`. */
export interface IngestSlot {
  readonly index: number;
  readonly client: ReplayDbClient;
}

/**
 * The ingest workers imports run on, one import per worker at a time. Slot 0 is the
 * app's main client; further slots get their own worker, created on first use and only
 * after the main client is ready, so the database schema is installed once, by one
 * worker. Slots above the current limit are closed when they fall idle.
 */
@Service()
export class IngestPool {
  private readonly main = inject(REPLAY_DB);
  private readonly create = inject(REPLAY_DB_FACTORY);
  private readonly clients = new Map<number, ReplayDbClient>([[0, this.main]]);
  private readonly busy = new Set<number>();

  /** How many extra workers exist (not counting the main client). */
  get extraWorkers(): number {
    return this.clients.size - 1;
  }

  /** Borrow a free worker among the first `limit`. The caller keeps fewer than `limit` borrowed. */
  async acquire(limit: number): Promise<IngestSlot> {
    let index = 0;
    while (this.busy.has(index)) index++;
    if (index >= limit) throw new Error(`no free import slot within ${limit}`);
    this.busy.add(index);
    let client = this.clients.get(index);
    if (!client) {
      try {
        await this.main.ready;
      } catch (err) {
        this.busy.delete(index);
        throw err;
      }
      client = this.create();
      this.clients.set(index, client);
    }
    return { index, client };
  }

  /** Return a worker; closed if it is now beyond `limit`. */
  release(slot: IngestSlot, limit: number): void {
    this.busy.delete(slot.index);
    if (slot.index >= limit) this.close(slot.index);
  }

  /** Close idle workers beyond `limit` (the main client always stays). */
  trim(limit: number): void {
    for (const index of [...this.clients.keys()])
      if (index >= limit && !this.busy.has(index)) this.close(index);
  }

  private close(index: number): void {
    if (index === 0) return;
    const client = this.clients.get(index);
    this.clients.delete(index);
    void client?.close();
  }
}
