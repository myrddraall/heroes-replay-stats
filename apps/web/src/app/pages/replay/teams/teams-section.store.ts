import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '@myrddraall/heroes-replay-stats-replays/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page.store';

/** {@link TeamsSection}'s component store: each team's stats in the replay its page shows. */
export const TeamsSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _teams: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.teamStats(params),
      }),
    };
  }),
  withComputed(({ _teams }) => ({
    /** Null until the team stats have been read. */
    teams: computed(() => (_teams.hasValue() ? _teams.value() : null)),
    error: computed(() => errorMessage(_teams.error() ?? null)),
  })),
);
