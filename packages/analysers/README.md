# @myrddraall/heroes-replay-stats-analysers

The replay analysers that are specific to Heroes Replay Stats. The generic ones
(description, score screen, player stats, draft, talents, XP, chat, commands, death
heatmap) stay in [`@myrddraall/heroprotocol-analysis`](https://github.com/myrddraall/heroprotocol);
the app's ingest worker (`packages/app/src/app/data/import/replay.worker.ts`) runs both
sets.

| Analyser             | Mode         | Tables (primary key)                                                                                                                                                                 |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timeline`           | `background` | `timelineEvents` (`[replayId+seq]`): alive/dead spans, deaths with killers, levels, talents, structure deaths, camp captures, objectives, core death, leavers — `kind`-discriminated |
| `points-of-interest` | `background` | `pointsOfInterest` (`[replayId+seq]`): cores, halls, towers, wells, gates, walls, watch towers, camps · `mapInfo` (`replayId`)                                                       |

Both were heroprotocol built-ins up to heroprotocol-analysis 0.4. They keep their ids
(`@myrddraall/timeline`, `@myrddraall/points-of-interest`) and table names, so runs
already stored in a browser stay valid.

The package is private and consumed from source: its `exports` point at `src/index.ts`,
which the app's TypeScript program and the Angular builder compile directly. There is no
build step.

## Tests

`pnpm test` checks the registry, and on the fixture replays compares every row with the
committed goldens in `test/fixtures/golden/` and checks the invariants below. Replays are
never committed; the tests read them from the heroprotocol checkout next to this repo
(`pnpm run fetch.fixtures` there) or from `HRS_REPLAY_FIXTURES`, and skip without them.
After a deliberate change to an analyser's output, run `pnpm run generate.analysis-goldens`
from the repo root.

## Where this differs from the 2018 viewer

- **Timeline**: level-up events were emitted twice and talent events never
  (`getTimlineEvents` spread `getTimlineLevelEvents` twice); level events carried a
  `talent` field read from the wrong list. Here each level-up appears once with its
  level and each talent pick once with its name and level.
