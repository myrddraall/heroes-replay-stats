import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '../../data';
import { TeamPerspective } from '../../ui';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page';
import { talentRows } from '../../ui';

/**
 * {@link TalentsSection}'s component store: the talents each player of the replay its page shows
 * picked, named and pictured from the replay's own build's hero data, coloured from your point
 * of view.
 */
export const TalentsSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _page: page,
      _perspective: inject(TeamPerspective),
      _picks: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.talentPicks(params),
      }),
    };
  }),
  withComputed(({ _page, _perspective, _picks }) => ({
    /** Null until the talents have been read. */
    rows: computed(() => {
      const replay = _page.replay();
      if (!replay || !_picks.hasValue()) return null;
      return talentRows(
        replay.players,
        _picks.value(),
        _page.icons(),
        _page.heroData(),
        _page.images(),
        _perspective.yourTeam(),
        _perspective.mode(),
      );
    }),
    error: computed(() => errorMessage(_picks.error() ?? null)),
  })),
);
