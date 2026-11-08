import { computed, inject } from '@angular/core';
import type { GameMode } from '@myrddraall/heroprotocol-db';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { withQueryParams } from '@myrddraall/heroes-replay-stats-data-views/data';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { ReplayImportJobStore } from '@myrddraall/heroes-replay-stats-import/data';
import { ReplayService, ViewedReplaysStore } from '../../data';
import { SettingsStore } from '@myrddraall/heroes-replay-stats-settings/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import {
  ANY_MATCH,
  filterMatches,
  matchOptions,
  PLAYED_WITHIN,
  type MatchFilter,
  type PlayedWithin,
} from '../../model';
import { MODE_LABELS, toReplayCard } from '../../ui';

/** The filter's query parameters, each at its default when not chosen. */
const QUERY = { q: '', map: '', mode: '', hero: '', played: 'any' };

/**
 * {@link ReplaysPage}'s component store: the stored replays as cards, importing ones included, and
 * the filter that narrows them, kept in the page's address.
 */
export const ReplaysPageStore = signalStore(
  withQueryParams(QUERY),
  withProps(() => ({
    _replays: inject(ReplayService),
    _settings: inject(SettingsStore),
    _heroData: inject(LatestHeroData),
    _imports: inject(ReplayImportJobStore),
    _viewed: inject(ViewedReplaysStore),
  })),
  withComputed(({ _replays, _settings, _heroData, _viewed, _imports, query }) => {
    const cards = computed(() => {
      const me = new Set(_settings.meToonHandles());
      const heroes = _heroData.lookup();
      const seen = _viewed.seen();
      const jobs = _imports.progressByReplay();
      return (
        _replays
          .listed()
          // one still importing only while its import runs: one that stopped part-way stays hidden
          .filter((r) => r.status === 'ready' || r.status === 'complete' || jobs.has(r.id))
          .map((r) => toReplayCard(r, me, heroes, seen[r.id], jobs.get(r.id) ?? null))
      );
    });
    /** The filter the address holds; a mode or a time it doesn't know is any. */
    const filter = computed((): MatchFilter => {
      const { q, map, mode, hero, played } = query();
      return {
        text: q,
        map,
        mode: mode in MODE_LABELS ? (mode as GameMode) : '',
        hero,
        played: PLAYED_WITHIN.includes(played as PlayedWithin) ? (played as PlayedWithin) : 'any',
      };
    });
    return {
      /** Every match, before filtering. */
      all: cards,
      filter,
      options: computed(() => matchOptions(cards())),
      /** The matches the filter keeps. */
      cards: computed(() => filterMatches(cards(), filter(), new Date())),
      outdated: _replays.outdated,
      loaded: _replays.loaded,
      error: computed(() => errorMessage(_replays.error())),
    };
  }),
  withMethods(({ _imports, setQuery }) => ({
    /** Opens the file picker to import replays. */
    importReplays(): void {
      void _imports.import();
    },
    /** Shows the matches this filter keeps. */
    setFilter(filter: MatchFilter = ANY_MATCH): void {
      const { text, map, mode, hero, played } = filter;
      setQuery({ q: text, map, mode, hero, played });
    },
  })),
);
