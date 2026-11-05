import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import {
  patchState,
  signalStoreFeature,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

/** A page's choices kept in its address: each a query parameter of the same name, as a string. */
export type QueryValues = Readonly<Record<string, string>>;

/** The values a query holds, each as given or else its default. */
function read<T extends QueryValues>(params: ParamMap, defaults: T): T {
  const values: Record<string, string> = { ...defaults };
  for (const key of Object.keys(defaults)) values[key] = params.get(key) ?? defaults[key]!;
  return values as T;
}

/**
 * A store's `query`: choices kept in its page's address (`?map=Sky%20Temple`), so they survive
 * opening something and coming back, a reload, and back and forward. A choice at its default is
 * left out of the address. `setQuery` changes some of them, in place of the current history entry.
 * For a component store, provided where its page's route is.
 */
export function withQueryParams<T extends QueryValues>(defaults: T) {
  return signalStoreFeature(
    withState({ query: defaults }),
    withMethods((store) => {
      const router = inject(Router);
      const route = inject(ActivatedRoute);
      return {
        setQuery(changes: Partial<T>): void {
          const query = { ...store.query(), ...changes } as T;
          patchState(store, { query });
          const queryParams = Object.fromEntries(
            Object.keys(defaults).map((key) => [key, query[key] === defaults[key] ? null : query[key]]),
          );
          void router.navigate([], {
            relativeTo: route,
            queryParams,
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        },
      };
    }),
    withHooks({
      onInit(store) {
        inject(ActivatedRoute)
          .queryParamMap.pipe(takeUntilDestroyed())
          .subscribe((params) => patchState(store, { query: read(params, defaults) }));
      },
    }),
  );
}
