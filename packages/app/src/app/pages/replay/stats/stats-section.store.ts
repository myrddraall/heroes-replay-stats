import { computed, inject } from '@angular/core';
import type { StatColumn, StatColumnChoice } from '@myrddraall/heroes-replay-stats-ui';
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
import { ReplayPageStore } from '../replay-page.store';
import { STAT_COLUMNS } from './stat-columns';
import { StatPresetsStore } from './stat-presets.store';
import { DEFAULT_PRESET, STAT_SECTIONS, type StatSectionId } from './stat-sections';

/** A column with what the replay's build can tell about its stat. */
export function withStatSupport(column: StatColumn, support: StatSupportTable): StatColumn {
  const entry = support[column.id] ?? support['*'];
  return entry ? { ...column, support: entry.support, notes: [entry.note] } : column;
}

const sameChoices = (a: readonly StatColumnChoice[], b: readonly StatColumnChoice[]): boolean =>
  a.length === b.length && a.every((c, i) => c.id === b[i]?.id && c.shown === b[i]?.shown);

/**
 * {@link StatsSection}'s component store: one player stats section of the replay its page shows,
 * which columns it shows in what order, and the presets those come from.
 */
export const StatsSectionStore = signalStore(
  withState({
    section: 'pvp' as StatSectionId,
    choices: STAT_SECTIONS.pvp.presets[DEFAULT_PRESET]!,
  }),
  withProps(() => ({ _replay: inject(ReplayPageStore), _presets: inject(StatPresetsStore) })),
  withComputed(({ section, choices, _replay, _presets }) => {
    const builtIn = computed(() => STAT_SECTIONS[section()].presets);
    const saved = computed(() => _presets.saved()[section()] ?? {});
    /** The section's columns, with the replay's support for each. */
    const columns = computed(() => {
      const support = _replay.playerStats()?.support ?? {};
      return STAT_COLUMNS.map((c) => withStatSupport(c, support));
    });
    return {
      title: computed(() => STAT_SECTIONS[section()].title),
      builtInPresets: computed(() => Object.keys(builtIn())),
      savedPresets: computed(() => Object.keys(saved())),
      /** The preset the columns match, built in first; null when they match none. */
      preset: computed(() => {
        const match = (presets: Readonly<Record<string, readonly StatColumnChoice[]>>) =>
          Object.entries(presets).find(([, c]) => sameChoices(c, choices()))?.[0];
        return match(builtIn()) ?? match(saved()) ?? null;
      }),
      columns,
      /**
       * The columns the table shows: chosen, in order, leaving out stats the replay's build does
       * not record and stats no player has (another map's, such as damage to the Immortals).
       */
      shownColumns: computed(() => {
        const byId = new Map(columns().map((c) => [c.id, c]));
        const players = _replay.playerStats()?.players ?? [];
        return choices().flatMap((choice) => {
          const column = choice.shown ? byId.get(choice.id) : undefined;
          return column && column.support !== 'none' && players.some((p) => column.id in p)
            ? [column]
            : [];
        });
      }),
      playerStats: _replay.playerStats,
      icons: _replay.icons,
    };
  }),
  withMethods((store) => ({
    /** Show this section, with its default columns. */
    show: signalMethod<StatSectionId>((section) =>
      patchState(store, { section, choices: STAT_SECTIONS[section].presets[DEFAULT_PRESET]! }),
    ),
    setChoices(choices: readonly StatColumnChoice[]): void {
      patchState(store, { choices });
    },
    choosePreset(name: string): void {
      const section = store.section();
      const choices =
        STAT_SECTIONS[section].presets[name] ?? store._presets.saved()[section]?.[name];
      if (choices) patchState(store, { choices });
    },
    savePreset(name: string): void {
      store._presets.save(store.section(), name, store.choices());
    },
    deletePreset(name: string): void {
      store._presets.remove(store.section(), name);
    },
  })),
);
