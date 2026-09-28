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
  templateUrl: './players-page.html',
  styleUrl: './players-page.scss',
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
