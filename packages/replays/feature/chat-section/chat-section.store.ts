import { computed, inject, resource } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { loadEmoticons } from '@myrddraall/hero-data';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { ReplayStatsService } from '../../data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page';
import { chatLogLines } from '../../ui';

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
      _chat: rxResource({
        params: () => page.replayId() ?? undefined,
        stream: ({ params }) => stats.chat(params),
      }),
      _emotes: resource({ loader: () => loadEmoticons() }),
    };
  }),
  withComputed(({ _page, _chat, _emotes }) => ({
    /**
     * Null until the chat has been read. Its emotes show once the hero data has loaded too: until
     * then the page has no pictures to name them by.
     */
    lines: computed(() =>
      _chat.hasValue()
        ? chatLogLines(
            _chat.value(),
            _emotes.hasValue() && _page.heroData() ? _emotes.value() : null,
            _page.heroes(),
            _page.images(),
            _page.icons(),
          )
        : null,
    ),
    error: computed(() => errorMessage(_chat.error() ?? null)),
  })),
);
