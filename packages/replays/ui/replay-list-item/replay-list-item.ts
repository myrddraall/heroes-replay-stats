import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { GameMode, Team } from '@myrddraall/heroprotocol-db';
import { RouterLink } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ItemFocus } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { teamColor, type ReplayViewed, type TeamColor } from '../../model';
import { TeamPerspective } from '../team-theme/team-perspective';
import { MatchTeam, type MatchTeamPlayer } from '../match-team/match-team';
import type { ReplayCard } from './replay-card';

export const MODE_LABELS: Readonly<Record<GameMode, string>> = {
  practice: 'Practice',
  'versus-ai': 'Versus AI',
  brawl: 'Brawl',
  'quick-match': 'Quick Match',
  'unranked-draft': 'Unranked Draft',
  'hero-league': 'Hero League',
  'team-league': 'Team League',
  'storm-league': 'Storm League',
  aram: 'ARAM',
  custom: 'Custom',
  'custom-draft': 'Custom Draft',
  unknown: 'Unknown mode',
};

const TEAM_NAMES: Readonly<Record<TeamColor, string>> = { blue: 'Blue team', red: 'Red team' };

/** A match you have not opened, or not since it was imported again; nothing once viewed. */
const VIEWED_LABELS: Readonly<Record<ReplayViewed, string | null>> = {
  new: 'New',
  viewed: null,
  updated: 'Updated',
};

/** `m:ss`, or `h:mm:ss` past an hour; `-m:ss` before the game's clock started (pre-game chat). */
export function formatDuration(seconds: number): string {
  if (Math.round(seconds) < 0) return `-${formatDuration(-seconds)}`;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * One replay in the list (presentational): where and when, whether you have looked at it, whether
 * it needs importing again, and who played what on each side, coloured from your point of view,
 * you in your own colour. Each side is named for screen readers only: its colour shows it.
 */
@Component({
  selector: 'hrs-replay-list-item',
  imports: [
    DatePipe,
    ItemFocus,
    MatChipsModule,
    MatProgressBarModule,
    RouterLink,
    Sprite,
    MatchTeam,
  ],
  providers: [TeamPerspective],
  templateUrl: './replay-list-item.html',
  styleUrl: './replay-list-item.scss',
})
export class ReplayListItem {
  readonly card = input.required<ReplayCard>();
  /** Its picture is among the first the page shows: loaded first. */
  readonly priority = input(false);
  private readonly perspective = inject(TeamPerspective);
  protected readonly replay = computed(() => this.card().replay);
  private readonly you = computed(() => this.card().you);

  constructor() {
    this.perspective.follow(computed(() => this.you().team));
  }

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
  protected readonly viewed = computed(() => VIEWED_LABELS[this.card().viewed]);
  /** What is happening to it ("importing…", "analysing…"); null once fully analysed. */
  protected readonly activity = computed(() => {
    const activity = this.card().activity;
    return activity === null ? null : `${activity}…`;
  });
  /** It opens once imported. */
  protected readonly opens = computed(() => this.card().activity !== 'importing');
  /** Its import job's progress, 0..100, while the job runs. */
  protected readonly progress = computed(() => {
    const progress = this.card().progress;
    return progress === null ? null : progress * 100;
  });
  /** Its length on the game's clock; a replay that ends before the gates open has none. */
  protected readonly duration = computed(() => {
    const seconds = this.replay().durationSeconds;
    return seconds === 0 ? 'Before the gates opened' : formatDuration(seconds);
  });
  protected readonly teams = computed(() => {
    const r = this.replay();
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    const yours = new Set(this.you().slots);
    const icons = this.card().icons;
    return ([0, 1] as const)
      .map((team: Team) => {
        const color = teamColor(team, yourTeam, mode);
        return {
          team,
          color,
          name: TEAM_NAMES[color],
          won: r.winningTeam === null ? null : r.winningTeam === team,
          // you first, then slot order
          players: r.players
            .filter((p) => p.team === team)
            .map(
              (p): MatchTeamPlayer => ({
                slot: p.slot,
                hero: p.hero,
                name: p.name,
                icon: icons[p.slot] ?? null,
                you: yours.has(p.slot),
              }),
            )
            .sort((a, b) => Number(b.you) - Number(a.you)),
        };
      })
      .sort((a, b) => (a.color === b.color ? 0 : a.color === 'blue' ? -1 : 1)); // blue on top
  });
  /** The map's replay preview image, behind the card. */
  protected readonly preview = computed(() => this.card().preview);
  protected readonly label = computed(() => `${this.replay().map}, ${this.mode()}`);
}
