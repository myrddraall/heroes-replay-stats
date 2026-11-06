import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ScoreTable } from '../stat-tables/score-table/score-table';
import { StatRowHead } from '../stat-tables/stat-row-head';
import type { AwardBadges, HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import type { ReplayScoreScreen } from '../../model';
import { teamColor } from '../../model';
import { TeamPerspective } from '../team-theme/team-perspective';
import { TeamTheme } from '../team-theme/team-theme';
import { HeroPortrait } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { playerRows } from '../stat-tables/player-rows';
import { SCORE_COLUMNS } from './score-columns';
import { AwardBadge } from '../award-badge/award-badge';

/** An award as a player's row shows it: the game's badge in the player's team colour and its words. */
export interface ShownAward {
  readonly id: string;
  /** The game's name for it (`Main Healer`), or the id in words when the data doesn't know it. */
  readonly name: string;
  /** Its name and what it is for (`Main Healer: Highest Healing`), for its tooltip. */
  readonly tooltip: string;
  /** Null until the data has loaded, and for an award the data names no badge for. */
  readonly picture: SpritePicture | null;
}

/**
 * The game's silence penalty icon for a player (the score screen's SilencedIcon: chat, voice or
 * both), from heroes-assets' score-screen sheet, and what it says; null when neither.
 */
export function silenceIcon(
  chat: boolean,
  voice: boolean,
): { readonly picture: string; readonly label: string } | null {
  if (chat && voice) {
    return { picture: 'score-screen#chat-and-voice-silenced', label: 'Chat and voice silenced' };
  }
  if (chat) return { picture: 'score-screen#chat-silenced', label: 'Chat silenced' };
  if (voice) return { picture: 'score-screen#voice-silenced', label: 'Voice silenced' };
  return null;
}

/** `MostXPContribution` as `Most XP contribution`. */
export function awardLabel(award: string): string {
  const words = award.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? [award];
  return words.map((w, i) => (i === 0 || w === w.toUpperCase() ? w : w.toLowerCase())).join(' ');
}

/**
 * A replay's score screen (presentational): each player's kills, assists, deaths, damage,
 * healing and experience, the best marked, their awards, and each team's level and kills across
 * the bottom; coloured from your point of view, your own row in your side's self theme. All of
 * it in one card (the theme's panel).
 */
@Component({
  selector: 'hrs-score-screen',
  imports: [
    AwardBadge,
    HeroPortrait,
    MatIcon,
    MatTooltip,
    ScoreTable,
    Sprite,
    StatRowHead,
    StyledText,
    TeamTheme,
  ],
  templateUrl: './score-screen.html',
  styleUrl: './score-screen.scss',
})
export class ScoreScreen {
  readonly scoreScreen = input.required<ReplayScoreScreen>();
  /** Each player's hero icon, by slot. */
  readonly icons = input.required<Readonly<Record<number, HeroIcon | null>>>();
  /** Each player's hero leaderboard portrait, by slot: the row heads show it, as the game does. */
  readonly portraits = input<Readonly<Record<number, HeroIcon | null>>>({});
  /** The slots that are you: your rows take your side's self theme. */
  readonly you = input<readonly number[]>([]);
  /** The badges of the awards given, by award id (`MostHealing`); `null` for one the data doesn't know. */
  readonly awards = input<Readonly<Record<string, AwardBadges | null>>>({});

  private readonly perspective = inject(TeamPerspective);
  protected readonly columns = SCORE_COLUMNS;
  protected readonly rows = computed(() =>
    playerRows(
      this.scoreScreen().players,
      this.icons(),
      this.columns,
      this.perspective.yourTeam(),
      this.perspective.mode(),
      new Set(this.you()),
    ),
  );
  /**
   * Each team's totals, blue first: named for you ("My Team", "Enemy Team") when you're known, by
   * their colour otherwise.
   */
  protected readonly teams = computed(() => {
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    return this.scoreScreen()
      .teams.map((team) => {
        const color = teamColor(team.team, yourTeam, mode);
        const name =
          yourTeam === null
            ? color === 'blue'
              ? 'Blue Team'
              : 'Red Team'
            : team.team === yourTeam
              ? 'My Team'
              : 'Enemy Team';
        return { ...team, name, blue: color === 'blue' };
      })
      .sort((a, b) => Number(b.blue) - Number(a.blue));
  });
  /**
   * Each player's awards, by slot: the badge in the player's team colour from your point of view, as
   * the game's score screen shows them (your side blue).
   */
  protected readonly silenceIcon = silenceIcon;
  protected readonly shownAwards = computed(() => {
    const yourTeam = this.perspective.yourTeam();
    const mode = this.perspective.mode();
    const badges = this.awards();
    return Object.fromEntries(
      this.scoreScreen().players.map((player) => {
        const color = player.team === null ? 'blue' : teamColor(player.team, yourTeam, mode);
        const shown = player.awards.map((id): ShownAward => {
          const badge = badges[id] ?? null;
          const name = badge?.name ?? awardLabel(id);
          return {
            id,
            name,
            tooltip: badge?.description ? `${name}: ${badge.description}` : name,
            picture: badge?.[color] ?? null,
          };
        });
        return [player.slot, shown];
      }),
    ) as Readonly<Record<number, readonly ShownAward[]>>;
  });
}
