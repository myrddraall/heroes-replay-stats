import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '@myrddraall/heroes-replay-stats-replays/data';
import { TeamPerspective } from '@myrddraall/heroes-replay-stats-replays/ui';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page.store';
import { draftSteps } from './draft-steps';

/**
 * {@link DraftSection}'s component store: the draft of the replay its page shows, its steps
 * coloured from your point of view.
 */
export const DraftSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _page: page,
      _perspective: inject(TeamPerspective),
      _draft: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.draft(params),
      }),
    };
  }),
  withComputed(({ _page, _perspective, _draft }) => ({
    /** Null until the draft has been read; empty for a game without a draft. */
    steps: computed(() => {
      if (!_draft.hasValue()) return null;
      const { draft, steps } = _draft.value();
      return draft?.picking === 'draft'
        ? draftSteps(steps, _page.heroes(), _perspective.yourTeam(), _perspective.mode())
        : [];
    }),
    /** How heroes were picked; `unknown` when the replay doesn't say, null until read. */
    picking: computed(() =>
      _draft.hasValue() ? (_draft.value().draft?.picking ?? 'unknown') : null,
    ),
    error: computed(() => errorMessage(_draft.error() ?? null)),
  })),
);
