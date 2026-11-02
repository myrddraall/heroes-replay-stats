import { computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { StatColumn, StatColumnChoice } from '@myrddraall/heroes-replay-stats-replays/ui';
import type { StatSupportTable } from '@myrddraall/heroprotocol-db';
import {
  patchState,
  signalMethod,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { ReplayStatsService } from '@myrddraall/heroes-replay-stats-replays/data';
import { errorMessage } from '@myrddraall/heroes-replay-stats-common/model';
import { ReplayPageStore } from '../replay-page.store';
import { withActivity } from './activity-stats';
import { allColumnChoices, sameShownColumns } from './stat-choices';
import { ACTIVITY_COLUMN_IDS, STAT_COLUMNS, STAT_SOURCES } from './stat-columns';
import { StatPresetsStore } from './stat-presets.store';
import { DEFAULT_PRESET, STAT_SECTIONS, type StatSectionId } from './stat-sections';

/**
 * A column with what the replay's build can tell about its stat, or about the score stat it is
 * worked out from (`source`); null for a stat that does not come from the score screen.
 */
export function withStatSupport(
  column: StatColumn,
  support: StatSupportTable,
  source: string | null = column.id,
): StatColumn {
  const entry = source === null ? undefined : (support[source] ?? support['*']);
  return entry ? { ...column, support: entry.support, notes: [entry.note] } : column;
}

/** The score stat a column's figure comes from; null for one read from the activity table. */
const statSource = (id: string): string | null =>
  ACTIVITY_COLUMN_IDS.has(id) ? null : (STAT_SOURCES[id] ?? id);

const COLUMN_IDS = STAT_COLUMNS.map((c) => c.id);

/** A preset's choices over every column (see {@link allColumnChoices}). */
const choicesOf = (preset: readonly StatColumnChoice[]): StatColumnChoice[] =>
  allColumnChoices(preset, COLUMN_IDS);

/**
 * {@link StatsSection}'s component store: one player stats section of the replay its page shows,
 * which columns it shows in what order, and the presets those come from. The choice covers every
 * column: the preset's first, then every other one hidden, so any column can be shown in any
 * section. A preset matches when the same columns are shown in the same order. The players'
 * activity (read from its own, slower analyser) is loaded only while one of its columns is shown.
 */
export const StatsSectionStore = signalStore(
  withState({
    section: 'pvp' as StatSectionId,
    choices: choicesOf(STAT_SECTIONS.pvp.presets[DEFAULT_PRESET]!) as readonly StatColumnChoice[],
  }),
  withProps(({ choices }) => {
    const replay = inject(ReplayPageStore);
    const stats = inject(ReplayStatsService);
    const needsActivity = computed(() =>
      choices().some((c) => c.shown && ACTIVITY_COLUMN_IDS.has(c.id)),
    );
    return {
      _replay: replay,
      _presets: inject(StatPresetsStore),
      _activity: rxResource({
        params: () => (needsActivity() ? (replay.replayId() ?? undefined) : undefined),
        stream: ({ params }) => stats.activity(params),
      }),
    };
  }),
  withComputed(({ section, choices, _replay, _presets, _activity }) => {
    const builtIn = computed(() => STAT_SECTIONS[section()].presets);
    const saved = computed(() => _presets.saved()[section()] ?? {});
    /** The section's columns, with the replay's support for each. */
    const columns = computed(() => {
      const support = _replay.playerStats()?.support ?? {};
      return STAT_COLUMNS.map((c) => withStatSupport(c, support, statSource(c.id)));
    });
    /** The players' stats, with their activity once it has been read. */
    const players = computed(() => {
      const rows = _replay.playerStats()?.players ?? [];
      return _activity.hasValue() ? withActivity(rows, _activity.value()) : rows;
    });
    return {
      title: computed(() => STAT_SECTIONS[section()].title),
      builtInPresets: computed(() => Object.keys(builtIn())),
      savedPresets: computed(() => Object.keys(saved())),
      /** The preset the columns match, built in first; null when they match none. */
      preset: computed(() => {
        const match = (presets: Readonly<Record<string, readonly StatColumnChoice[]>>) =>
          Object.entries(presets).find(([, c]) => sameShownColumns(choicesOf(c), choices()))?.[0];
        return match(builtIn()) ?? match(saved()) ?? null;
      }),
      columns,
      /**
       * The columns the table shows: chosen, in order, leaving out stats the replay's build does
       * not record and stats no player has (another map's, such as damage to the Immortals).
       */
      shownColumns: computed(() => {
        const byId = new Map(columns().map((c) => [c.id, c]));
        return choices().flatMap((choice) => {
          const column = choice.shown ? byId.get(choice.id) : undefined;
          return column && column.support !== 'none' && players().some((p) => column.id in p)
            ? [column]
            : [];
        });
      }),
      /** Null until the player stats have been read. */
      players: computed(() => (_replay.playerStats() ? players() : null)),
      /** Whether shown activity columns are still being read. */
      activityLoading: _activity.isLoading,
      activityError: computed(() => errorMessage(_activity.error() ?? null)),
      icons: _replay.icons,
    };
  }),
  withMethods((store) => ({
    /** Show this section, with its default columns. */
    show: signalMethod<StatSectionId>((section) =>
      patchState(store, {
        section,
        choices: choicesOf(STAT_SECTIONS[section].presets[DEFAULT_PRESET]!),
      }),
    ),
    setChoices(choices: readonly StatColumnChoice[]): void {
      patchState(store, { choices });
    },
    choosePreset(name: string): void {
      const section = store.section();
      const choices =
        STAT_SECTIONS[section].presets[name] ?? store._presets.saved()[section]?.[name];
      if (choices) patchState(store, { choices: choicesOf(choices) });
    },
    savePreset(name: string): void {
      store._presets.save(store.section(), name, store.choices());
    },
    deletePreset(name: string): void {
      store._presets.remove(store.section(), name);
    },
  })),
);
