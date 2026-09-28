import { DatePipe, PercentPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReplayImportJobStore } from '../../data/import/replay-import-job.store';
import { PlayerService, type PlayerSummary } from '../../data/players/player.service';
import { SettingsStore } from '../../data/settings/settings.store';
import { EmptyState } from '../empty-state';

const REGIONS: Readonly<Record<number, string>> = { 1: 'NA', 2: 'EU', 3: 'KR', 5: 'CN' };
/** How many of a player's heroes the list names; the rest are counted. */
const HEROES_SHOWN = 3;

@Component({
  selector: 'hrs-players-page',
  imports: [
    DatePipe,
    PercentPipe,
    EmptyState,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  template: `
    <header class="head">
      <h1>Players</h1>
      @if (players.players().length > 0) {
        <span class="count"
          >{{ players.players().length }}
          {{ players.players().length === 1 ? 'player' : 'players' }}</span
        >
      }
    </header>
    @if (players.error(); as error) {
      <p class="error" role="alert">The replay database could not be read: {{ message(error) }}</p>
    } @else if (!players.loaded()) {
      <mat-progress-bar mode="indeterminate" aria-label="Loading players" />
    } @else if (players.players().length === 0) {
      <hrs-empty-state icon="groups" title="Nobody here yet">
        Players appear once replays are imported.
        <br /><button mat-stroked-button class="cta" (click)="imports.import()">
          Import replays
        </button>
      </hrs-empty-state>
    } @else {
      <table class="players">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" class="num">Games</th>
            <th scope="col">Record</th>
            <th scope="col">Last played</th>
            <th scope="col">Heroes</th>
            <th scope="col" class="me">Me</th>
          </tr>
        </thead>
        <tbody>
          @for (p of players.players(); track p.id) {
            <tr>
              <th scope="row" class="player">
                <span class="player__name">{{ p.name }}</span>
                @if (region(p); as r) {
                  <span class="player__region">{{ r }}</span>
                }
              </th>
              <td class="num" data-label="Games">{{ p.games }}</td>
              <td data-label="Record">
                <span class="record">
                  <span class="record__wl">{{ p.wins }}–{{ p.losses }}</span>
                  @if (p.winRate !== null) {
                    <span class="record__rate" [class.record__rate--good]="p.winRate >= 0.5">{{
                      p.winRate | percent: '1.0-0'
                    }}</span>
                  }
                </span>
              </td>
              <td data-label="Last played">
                <time [attr.datetime]="p.lastPlayedAt">{{
                  p.lastPlayedAt | date: 'MMM d, y'
                }}</time>
              </td>
              <td data-label="Heroes" class="heroes-cell">
                <div class="heroes">
                  @for (h of topHeroes(p); track h.hero) {
                    <span class="hero"
                      >{{ h.hero }}
                      @if (h.games > 1) {
                        <span class="hero__games">×{{ h.games }}</span>
                      }
                    </span>
                  }
                  @if (moreHeroes(p) > 0) {
                    <span class="hero hero--more">+{{ moreHeroes(p) }} more</span>
                  }
                </div>
              </td>
              <td data-label="Me" class="me">
                @if (hasHandle(p)) {
                  <mat-checkbox
                    [checked]="isMe(p)"
                    (change)="settings.setMe(p.id, $event.checked)"
                    [aria-label]="p.name + ' is me'"
                  />
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }
    .count {
      color: var(--mat-sys-on-surface-variant);
    }
    .cta {
      margin-top: 16px;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .players {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--hrs-border);
      border-radius: 12px;
      overflow: hidden;
      background: var(--hrs-surface);
    }
    th,
    td {
      padding: 10px 16px;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid var(--hrs-border);
    }
    tbody tr:last-child > * {
      border-bottom: none;
    }
    thead th {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: var(--hrs-surface-raised);
    }
    .me {
      width: 1%;
      text-align: center;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .player {
      font-weight: normal;
    }
    .player__name {
      color: #fff;
      font: var(--mat-sys-title-small);
    }
    .player__region {
      margin-left: 8px;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .record {
      display: inline-flex;
      gap: 10px;
      font-variant-numeric: tabular-nums;
    }
    .record__rate {
      color: var(--mat-sys-on-surface-variant);
    }
    .record__rate--good {
      color: var(--hrs-bronze);
    }
    time {
      color: var(--mat-sys-on-surface-variant);
    }
    .heroes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .hero {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(0, 117, 255, 0.16);
      font: var(--mat-sys-body-small);
      color: #fff;
      white-space: nowrap;
    }
    .hero__games {
      color: var(--hrs-blue-soft);
    }
    .hero--more {
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 700px) {
      .players,
      .players tbody,
      .players tr,
      .players th,
      .players td {
        display: block;
      }
      .players thead {
        display: none;
      }
      .players {
        border: none;
        background: none;
      }
      .players tbody {
        display: grid;
        gap: 12px;
      }
      .players tr {
        padding: 12px 14px;
        border: 1px solid var(--hrs-border);
        border-radius: 12px;
        background: var(--hrs-surface);
      }
      .players th,
      .players td {
        padding: 2px 0;
        border: none;
        text-align: left;
      }
      .players td::before {
        content: attr(data-label);
        display: inline-block;
        min-width: 7rem;
        font: var(--mat-sys-label-small);
        color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .players .heroes-cell {
        padding-top: 6px;
      }
      .players .heroes-cell::before {
        display: none;
      }
    }
  `,
})
export class PlayersPage {
  protected readonly imports = inject(ReplayImportJobStore);
  protected readonly players = inject(PlayerService);
  protected readonly settings = inject(SettingsStore);
  private readonly me = computed(() => new Set(this.settings.meToonHandles()));

  /** Only accounts with a toon handle can be marked as me; `name:` ids are not accounts. */
  protected hasHandle(p: PlayerSummary): boolean {
    return !p.id.startsWith('name:');
  }

  protected isMe(p: PlayerSummary): boolean {
    return this.me().has(p.id);
  }

  protected region(p: PlayerSummary): string | null {
    return p.region === null ? null : (REGIONS[p.region] ?? null);
  }

  protected topHeroes(p: PlayerSummary): PlayerSummary['heroes'] {
    return p.heroes.slice(0, HEROES_SHOWN);
  }

  protected moreHeroes(p: PlayerSummary): number {
    return Math.max(0, p.heroes.length - HEROES_SHOWN);
  }

  protected message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
