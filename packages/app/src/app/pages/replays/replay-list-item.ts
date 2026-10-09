import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { GameMode, Team } from '@myrddraall/heroprotocol-db';
import { HeroMinimapIcon } from '../../heroes/hero-minimap-icon';
import { teamColor, type TeamColor, TeamPerspective } from '../../team/team-color';
import { TeamTheme } from '../../team/team-theme';
import type { ReplayCard } from './replay-card';

const MODE_LABELS: Readonly<Record<GameMode, string>> = {
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

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * One replay in the list (presentational): where and when, and who played what on each side,
 * coloured from your point of view.
 */
@Component({
  selector: 'hrs-replay-list-item',
  imports: [DatePipe, HeroMinimapIcon, NgOptimizedImage, TeamTheme],
  providers: [TeamPerspective],
  templateUrl: './replay-list-item.html',
  styleUrl: './replay-list-item.scss',
})
export class ReplayListItem {
  readonly card = input.required<ReplayCard>();
  private readonly perspective = inject(TeamPerspective);
  protected readonly replay = computed(() => this.card().replay);
  private readonly you = computed(() => this.card().you);

  constructor() {
    this.perspective.follow(computed(() => this.you().team));
  }

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
  protected readonly duration = computed(() => formatDuration(this.replay().durationSeconds));
  protected readonly teams = computed(() => {
    const r = this.replay();
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    const yours = new Set(this.you().slots);
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
            .sort((a, b) => Number(yours.has(b.slot)) - Number(yours.has(a.slot))),
        };
      })
      .sort((a, b) => (a.color === b.color ? 0 : a.color === 'blue' ? -1 : 1)); // blue on top
  });
  /** The map's replay preview image, behind the card. */
  protected readonly preview = computed(() => this.card().preview);
  protected readonly icons = computed(() => this.card().icons);
  protected readonly label = computed(() => `${this.replay().map}, ${this.mode()}`);
}
