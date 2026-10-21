/**
 * The analysers specific to Heroes Replay Stats. They run in the app's ingest worker
 * next to the generic built-ins from @myrddraall/heroprotocol-analysis.
 */
import type { AnyAnalyser } from '@myrddraall/heroprotocol-db';
import { pointsOfInterest } from './analysers/pointsOfInterest.js';
import { timeline } from './analysers/timeline.js';

export { timeline } from './analysers/timeline.js';
export type { TimelineEventRow, TimelineKind, TimelineTables } from './analysers/timeline.js';
export { pointsOfInterest } from './analysers/pointsOfInterest.js';
export type {
  PointOfInterestRow,
  MapInfoRow,
  PoiType,
  PointsOfInterestTables,
} from './analysers/pointsOfInterest.js';

/** Every app analyser, in the order the ingest runs them. Both run in the background. */
export const analysers: readonly AnyAnalyser[] = [timeline, pointsOfInterest];
