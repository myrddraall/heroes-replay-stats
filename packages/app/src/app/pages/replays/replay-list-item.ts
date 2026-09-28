import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { GameMode, Team } from '@myrddraall/heroprotocol-db';
import type { ReplaySummary } from '../../data/replays/replay.service';

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

const TEAM_NAMES: Readonly<Record<Team, string>> = { 0: 'Blue team', 1: 'Red team' };

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** One replay in the list: where and when, and who played what on each side. */
@Component({
  selector: 'hrs-replay-list-item',
  imports: [DatePipe],
  templateUrl: './replay-list-item.html',
  styleUrl: './replay-list-item.scss',
})
export class ReplayListItem {
  readonly replay = input.required<ReplaySummary>();

  protected readonly mode = computed(() => MODE_LABELS[this.replay().mode]);
  protected readonly duration = computed(() => formatDuration(this.replay().durationSeconds));
  protected readonly teams = computed(() => {
    const r = this.replay();
    return ([0, 1] as const).map((team) => ({
      team,
      name: TEAM_NAMES[team],
      won: r.winningTeam === null ? null : r.winningTeam === team,
      players: r.players.filter((p) => p.team === team),
    }));
  });
  protected readonly label = computed(() => `${this.replay().map}, ${this.mode()}`);
}
