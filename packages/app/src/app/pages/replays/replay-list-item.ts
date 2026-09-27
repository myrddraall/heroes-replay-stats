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
  template: `
    <article class="replay" [attr.aria-label]="label()">
      <header class="replay__head">
        <h2 class="replay__map">{{ replay().map }}</h2>
        <span class="replay__mode">{{ mode() }}</span>
        <time class="replay__when" [attr.datetime]="replay().playedAt">{{
          replay().playedAt | date: 'MMM d, y, HH:mm'
        }}</time>
      </header>
      <p class="replay__meta">
        {{ duration() }} · build {{ replay().build }}
        @if (replay().status === 'ready') {
          · <span class="replay__analysing">analysing…</span>
        }
      </p>
      <div class="replay__teams">
        @for (team of teams(); track team.team) {
          <div class="team" [class.team--won]="team.won" [class]="'team--' + team.team">
            <span class="team__name">
              {{ team.name }}
              @if (team.won !== null) {
                <span class="team__result">{{ team.won ? 'Victory' : 'Defeat' }}</span>
              }
            </span>
            <ul class="team__players">
              @for (p of team.players; track p.slot) {
                <li class="player">
                  <span class="player__hero">{{ p.hero }}</span>
                  <span class="player__name">{{ p.name }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    .replay {
      padding: 16px 20px;
      border: 1px solid var(--hrs-border);
      border-radius: 12px;
      background: var(--hrs-surface);
    }
    .replay__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 12px;
    }
    .replay__map {
      margin: 0;
      font: var(--mat-sys-title-large);
      font-family: 'Exo 2', sans-serif;
      font-weight: 600;
      color: #fff;
    }
    .replay__mode {
      color: var(--hrs-bronze);
      font: var(--mat-sys-label-large);
    }
    .replay__when {
      margin-left: auto;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
    .replay__meta {
      margin: 4px 0 12px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .replay__analysing {
      color: var(--hrs-blue-soft);
    }
    .replay__teams {
      display: grid;
      gap: 8px;
    }
    .team {
      display: grid;
      grid-template-columns: 9rem minmax(0, 1fr);
      align-items: center;
      gap: 8px 12px;
      padding: 8px 12px;
      border-radius: 8px;
      border-left: 3px solid transparent;
    }
    .team--0 {
      background: rgba(27, 56, 116, 0.35);
      border-left-color: #3d7bff;
    }
    .team--1 {
      background: rgba(102, 7, 48, 0.35);
      border-left-color: #ff4d7d;
    }
    .team__name {
      display: grid;
      font: var(--mat-sys-label-large);
      color: #fff;
    }
    .team__result {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .team--won .team__result {
      color: var(--hrs-bronze);
    }
    .team__players {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
    }
    .player {
      display: grid;
      min-width: 0;
    }
    .player__hero {
      font: var(--mat-sys-body-medium);
      color: #fff;
    }
    .player__name {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 12ch;
    }
    @media (max-width: 600px) {
      .replay {
        padding: 12px 14px;
      }
      .replay__when {
        margin-left: 0;
        width: 100%;
      }
      .team {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
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
