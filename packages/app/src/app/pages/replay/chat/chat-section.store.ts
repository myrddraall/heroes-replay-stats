import { computed, inject, resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { loadEmoticons } from '@myrddraall/hero-data';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { LatestHeroData } from '../../../data/heroes/hero-data';
import { ReplayStatsService } from '../../../data/replays/replay-stats.service';
import { errorMessage } from '../../error-message';
import { ReplayPageStore } from '../replay-page.store';
import { chatLogLines } from './chat-log-lines';

/**
 * {@link ChatSection}'s component store: the chat of the replay its page shows, with the emotes
 * (loaded once, when chat is first shown) as the senders' games showed them.
 */
export const ChatSectionStore = signalStore(
  withProps(() => {
    const page = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    return {
      _page: page,
      _heroData: inject(LatestHeroData),
      _chat: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.chat(params),
      }),
      _emotes: resource({ loader: () => loadEmoticons() }),
    };
  }),
  withComputed(({ _page, _heroData, _chat, _emotes }) => ({
    /** Null until the chat has been read. */
    lines: computed(() =>
      _chat.hasValue()
        ? chatLogLines(
            _chat.value(),
            _emotes.hasValue() ? _emotes.value() : null,
            _heroData.lookup(),
            _heroData.images,
            _page.icons(),
          )
        : null,
    ),
    error: computed(() => errorMessage(_chat.error() ?? null)),
  })),
);
