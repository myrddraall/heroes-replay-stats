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
 * of view, your own rows in your self theme.
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
    /**
     * The talent screen: its rows and the teams' totals across its bottom. Null until the talents
     * and the score screen (the totals and each player's silence penalties) have been read.
     */
    screen: computed(() => {
      const replay = _page.replay();
      const scoreScreen = _page.scoreScreen();
      if (!replay || !scoreScreen || !_picks.hasValue()) return null;
      const scored = new Map(scoreScreen.players.map((p) => [p.slot, p]));
      const players = replay.players.map((p) => ({
        ...p,
        silenced: scored.get(p.slot)?.silenced ?? false,
        voiceSilenced: scored.get(p.slot)?.voiceSilenced ?? false,
      }));
      const rows = talentRows(
        players,
        _picks.value(),
        _page.portraits(),
        _page.heroData(),
        _page.images(),
        _perspective.yourTeam(),
        _perspective.mode(),
        new Set(_page.you().slots),
      );
      return { rows, teams: scoreScreen.teams };
    }),
    error: computed(() => errorMessage(_picks.error() ?? null)),
  })),
);
