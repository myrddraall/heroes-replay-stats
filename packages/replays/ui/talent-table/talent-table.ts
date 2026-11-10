import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { CellTemplate, DataGrid, GridColumn, GridHeader, GridRowElement, HeaderTemplate, RowTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { TalentFrame, TalentTooltip } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { ScoreRowBar } from '../stat-tables/score-row/score-row-bar';
import { ScoreRowHead } from '../stat-tables/score-row/score-row-head';
import { ScoreTeams } from '../stat-tables/score-teams/score-teams';
import type { ScoreScreenTeamRow } from '@myrddraall/heroprotocol-analysis';
import { HEROIC_TALENT_TIER, TALENT_TIER_LEVELS, TALENT_TIERS, type TalentRow } from './talent-rows';
import { StyledText, Tooltip } from '@myrddraall/heroes-replay-stats-common/ui';

/**
 * A replay's talents (presentational), as the game's talent screen (TalentsOverviewPanel) in the
 * score screen's look: one card, a score row per player (its row head the score screen's), coloured
 * from your point of view, your own row in your side's self theme, and the talent each picked at
 * each tier in the game's talent frame (heroic or not, picked or empty), centred in the tier's
 * column under the level it opens at, the game's talent tooltip on it (its name, level and full
 * text), its name and level its alt text; the teams'
 * totals across the bottom, and, as the game's score screen ends its rows with tools, a button
 * copying the player's build as the game links it in chat, to paste into the game.
 */
@Component({
  selector: 'hrs-talent-table',
  imports: [GridHeader, GridRowElement, RowTemplate, CellTemplate, DataGrid, GridColumn, HeaderTemplate, MatIconButton, MatTooltip, Sprite, ScoreRowBar, ScoreRowHead, ScoreTeams, StyledText, TalentFrame, TalentTooltip, Tooltip],
  templateUrl: './talent-table.html',
  styleUrl: './talent-table.scss',
})
export class TalentTable {
  readonly rows = input.required<readonly TalentRow[]>();
  /** The teams' totals, across the bottom as on the score screen. */
  readonly teams = input.required<readonly ScoreScreenTeamRow[]>();
  protected readonly tiers = TALENT_TIERS;
  protected readonly levels = TALENT_TIER_LEVELS;
  protected readonly heroicTier = HEROIC_TALENT_TIER;

  private readonly clipboard = inject(Clipboard);
  private readonly announcer = inject(LiveAnnouncer);
  /** The row whose build was just copied, for its button's tooltip to say so. */
  protected readonly copied = signal<number | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));
  }

  /**
   * Copies a row's build link to the clipboard, and says so for a moment: its button's tooltip
   * (which a click closes) shown again, saying it was copied.
   */
  protected copy(key: number, build: string, tooltip: MatTooltip): void {
    if (!this.clipboard.copy(build)) return;
    this.copied.set(key);
    setTimeout(() => tooltip.show(0));
    void this.announcer.announce(`Copied the talent build ${build}`);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copied.set(null), 2000);
  }
  protected readonly byKey = (row: TalentRow) => row.key;
  protected readonly themeOf = (row: TalentRow) => row.theme ?? null;
}
