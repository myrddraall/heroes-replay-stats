import type { Team } from '@myrddraall/heroprotocol-db';
import {
  type ReplayPlayer,
  type ReplayTimeline,
  type TeamColor,
  teamColor,
  type TeamColorMode,
  timelineSeconds,
} from '../../model';
import { teamName } from '../stat-tables/team-rows';

/** Something that happened in the game, as a line of text, coloured by the team it was about. */
export interface GameEvent {
  readonly seconds: number;
  /** The team it is about (the one that died, levelled or destroyed), in its colour. */
  readonly color: TeamColor | null;
  readonly text: string;
}

/** The team levels that open a talent tier. */
const TIER_LEVELS = new Set([4, 7, 10, 13, 16, 20]);

/**
 * The turns of the game, in order: each team reaching a talent tier, each fort, keep and core
 * destroyed, and each hero death.
 */
export function gameEvents(
  timeline: ReplayTimeline,
  players: readonly ReplayPlayer[],
  yourTeam: Team | null,
  mode: TeamColorMode,
): GameEvent[] {
  const color = (team: Team | null) => (team === null ? null : teamColor(team, yourTeam, mode));
  const name = (team: Team | null) => {
    const c = color(team);
    return c ? teamName(c) : 'A team';
  };
  const bySlot = new Map(players.map((p) => [p.slot, p]));
  const events: GameEvent[] = [];
  for (const e of timeline.events) {
    const seconds = timelineSeconds(timeline, e.start);
    switch (e.kind) {
      case 'team-level':
        if (e.level !== null && TIER_LEVELS.has(e.level))
          events.push({
            seconds,
            color: color(e.team),
            text: `${name(e.team)} reached level ${e.level}`,
          });
        break;
      case 'structure-death': {
        const what = e.unitType?.startsWith('TownTownHallL3')
          ? 'keep'
          : e.unitType?.startsWith('TownTownHallL2')
            ? 'fort'
            : null;
        if (what)
          events.push({
            seconds,
            color: color(e.team),
            text: `${name(e.team)} destroyed a ${what}`,
          });
        break;
      }
      case 'core-death':
        events.push({
          seconds,
          color: color(e.team),
          text: `${name(e.team)}'s core was destroyed`,
        });
        break;
      case 'death': {
        const player = e.slot === null ? undefined : bySlot.get(e.slot);
        if (player)
          events.push({
            seconds,
            color: color(player.team),
            text: `${player.hero} (${player.name}) died`,
          });
        break;
      }
      default:
        break;
    }
  }
  return events;
}
