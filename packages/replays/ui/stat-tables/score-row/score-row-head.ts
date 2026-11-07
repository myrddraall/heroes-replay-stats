import { Component, computed, input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { StyledText } from '@myrddraall/heroes-replay-stats-common/ui';
import type { HeroIcon } from '@myrddraall/heroes-replay-stats-heroes/model';
import { HeroPortrait } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/** A silence penalty as a row head shows it: the game's icon, its words and the game's tooltip. */
export interface SilenceIcon {
  /** The picture in heroes-assets' score-screen sheet. */
  readonly picture: string;
  readonly label: string;
  /** The game's own tooltip for it (UI/BattleUser/… in its strings). */
  readonly tooltip: string;
}

/**
 * The game's silence penalty icon for a player (its SilencedIconTemplate: chat, voice or both),
 * what it says and the game's tooltip for it; null when neither.
 */
export function silenceIcon(chat: boolean, voice: boolean): SilenceIcon | null {
  if (chat && voice) {
    return {
      picture: 'score-screen#chat-and-voice-silenced',
      label: 'Chat and voice silenced',
      tooltip:
        'This player is currently silenced. They can only Chat with friends and party members, and can only speak in party Voice. This player cannot participate in Storm League games.',
    };
  }
  if (chat) {
    return {
      picture: 'score-screen#chat-silenced',
      label: 'Chat silenced',
      tooltip:
        'This player is currently silenced and can only Chat with friends and party members. This player cannot participate in Storm League games.',
    };
  }
  if (voice) {
    return {
      picture: 'score-screen#voice-silenced',
      label: 'Voice silenced',
      tooltip: 'This player is currently silenced and can only speak in party Voice.',
    };
  }
  return null;
}

/**
 * A player's row head as the game's score and talent screens draw it (GameStatsPanel,
 * TalentsOverviewPanel: PlayerHeroIconFrame and the name frames): the hero's leaderboard portrait
 * the row's full height, fading out to the right (Storm_UI_InGame_Leader_ScoreInset_PortraitFade:
 * solid to 46%, gone at the edge), the silence icon at its top right, the hero's name bright over
 * its end and the player's below it, smaller; its content (a screen's own, such as the score
 * screen's awards) at its right end. In a score row (`_score-row.scss`): sized from the row's
 * height (`--hrs-grid-row-height`) and its type.
 */
@Component({
  selector: 'ui-score-row-head',
  imports: [HeroPortrait, MatTooltip, Sprite, StyledText],
  templateUrl: './score-row-head.html',
  styleUrl: './score-row-head.scss',
})
export class ScoreRowHead {
  readonly hero = input.required<string>();
  readonly name = input.required<string>();
  /** The hero's leaderboard portrait; none until the hero data has loaded. */
  readonly portrait = input<HeroIcon | null>(null);
  readonly silenced = input(false);
  readonly voiceSilenced = input(false);
  protected readonly silence = computed(() => silenceIcon(this.silenced(), this.voiceSilenced()));
}
