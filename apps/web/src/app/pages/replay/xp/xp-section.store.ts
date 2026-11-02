import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '../../../data/replays/replay-stats.service';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page.store';

/** {@link XpSection}'s component store: each team's XP over the replay its page shows. */
export const XpSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _points: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.xpPoints(params),
      }),
    };
  }),
  withComputed(({ _points }) => ({
    /** Null until the XP has been read. */
    points: computed(() => (_points.hasValue() ? _points.value() : null)),
    error: computed(() => errorMessage(_points.error() ?? null)),
  })),
);
