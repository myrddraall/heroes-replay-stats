import { signal, type Signal } from '@angular/core';
import { liveQuery } from 'dexie';

/** A Dexie live query as signals: the latest result, whether it has arrived, and the last error. */
export interface LiveQuerySignals<T> {
  readonly value: Signal<T>;
  readonly loaded: Signal<boolean>;
  readonly error: Signal<unknown>;
}

/**
 * Run `query` as a Dexie live query once `ready` resolves, and keep the signals up to
 * date as the database changes (including writes from the ingest worker). `initial` is
 * the value until the first result. Lives as long as the app: meant for root services.
 */
export function liveQuerySignals<T>(
  ready: Promise<unknown>,
  query: () => Promise<T>,
  initial: T,
): LiveQuerySignals<T> {
  const value = signal(initial);
  const loaded = signal(false);
  const error = signal<unknown>(null);
  ready.then(
    () =>
      liveQuery(query).subscribe({
        next: (v) => {
          value.set(v);
          loaded.set(true);
          error.set(null);
        },
        error: (e: unknown) => error.set(e),
      }),
    (e: unknown) => error.set(e),
  );
  return { value: value.asReadonly(), loaded: loaded.asReadonly(), error: error.asReadonly() };
}
