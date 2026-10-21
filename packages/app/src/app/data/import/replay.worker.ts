/// <reference lib="webworker" />
/**
 * The app's ingest worker: the generic analysers from @myrddraall/heroprotocol-analysis
 * plus the app's own (timeline, points of interest) from
 * @myrddraall/heroes-replay-stats-analysers.
 */
import { analysers } from '@myrddraall/heroes-replay-stats-analysers';
import { builtins } from '@myrddraall/heroprotocol-analysis';
import { createWorker } from '@myrddraall/heroprotocol-db/worker';

// heroprotocol-analysis 0.4 still ships timeline and points-of-interest as built-ins;
// the app's copies replace them. Once the app is on 0.5 the filter drops nothing.
const ours = new Set(analysers.map((a) => a.id));
createWorker({ analysers: [...builtins.filter((a) => !ours.has(a.id)), ...analysers] });
