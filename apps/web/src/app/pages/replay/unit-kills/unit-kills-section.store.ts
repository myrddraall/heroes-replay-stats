import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '@myrddraall/heroes-replay-stats-replays/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page.store';

/** {@link UnitKillsSection}'s component store: the unit kills of the replay its page shows. */
export const UnitKillsSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _kills: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.unitKills(params),
      }),
      icons: page.icons,
    };
  }),
  withComputed(({ _kills }) => ({
    /** Null until the kills have been read. */
    kills: computed(() => (_kills.hasValue() ? _kills.value() : null)),
    error: computed(() => errorMessage(_kills.error() ?? null)),
  })),
);
