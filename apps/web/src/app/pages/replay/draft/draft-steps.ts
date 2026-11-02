import type { DraftStepRow } from '@myrddraall/heroprotocol-analysis';
import type { Team } from '@myrddraall/heroprotocol-db';
import type { HeroIcon, HeroLookup } from '@myrddraall/heroes-replay-stats-heroes/model';
import { teamColor, type TeamColorMode } from '../../../team/team-color';
import { teamName } from '../team-rows';

/** One ban or pick as the draft shows it. */
export interface DraftStep {
  readonly key: number;
  /** 1-based, in the draft's order. */
  readonly order: number;
  readonly action: 'Ban' | 'Pick';
  readonly team: Team | null;
  /** The team's name from your point of view; null when the step has no team. */
  readonly teamName: string | null;
  /** The hero's name: the replay's for a pick, the hero data's for a ban (its id otherwise). */
  readonly hero: string;
  readonly icon: HeroIcon | null;
  /** Who picked it; null for a ban. */
  readonly player: string | null;
}

/** The draft's bans and picks in order, each with its team, hero and (for a pick) player. */
export function draftSteps(
  steps: readonly DraftStepRow[],
  heroes: HeroLookup,
  yourTeam: Team | null,
  mode: TeamColorMode,
): DraftStep[] {
  return steps.map((s) => {
    const icon = heroes.heroIcon(s.heroId, s.hero ?? undefined);
    return {
      key: s.order,
      order: s.order,
      action: s.type === 'ban' ? 'Ban' : 'Pick',
      team: s.team,
      teamName: s.team === null ? null : teamName(teamColor(s.team, yourTeam, mode)),
      hero: s.hero ?? icon?.name ?? s.heroId,
      icon,
      player: s.name,
    };
  });
}
