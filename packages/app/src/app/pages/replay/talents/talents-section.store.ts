import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { LatestHeroData } from '../../../data/heroes/hero-data';
import { ReplayStatsService } from '../../../data/replays/replay-stats.service';
import { TeamPerspective } from '../../../team/team-color';
import { errorMessage } from '../../error-message';
import { ReplayPageStore } from '../replay-page.store';
import { talentRows } from './talent-rows';

/**
 * {@link TalentsSection}'s component store: the talents each player of the replay its page shows
 * picked, named and pictured from the hero data, coloured from your point of view.
 */
export const TalentsSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _page: page,
      _heroData: inject(LatestHeroData),
      _perspective: inject(TeamPerspective),
      _picks: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.talentPicks(params),
      }),
    };
  }),
  withComputed(({ _page, _heroData, _perspective, _picks }) => ({
    /** Null until the talents have been read. */
    rows: computed(() => {
      const replay = _page.replay();
      if (!replay || !_picks.hasValue()) return null;
      return talentRows(
        replay.players,
        _picks.value(),
        _page.icons(),
        _heroData.data.hasValue() ? (_heroData.data.value() ?? null) : null,
        _heroData.images,
        _perspective.yourTeam(),
        _perspective.mode(),
      );
    }),
    error: computed(() => errorMessage(_picks.error() ?? null)),
  })),
);
