import { Component, input } from '@angular/core';
import { Sprite } from '@myrddraall/heroes-replay-stats-common/ui';
import { HeroMinimapIcon } from '../../../heroes/hero-minimap-icon';
import { TeamTheme } from '../../../team/team-theme';
import type { ChatLogLine } from './chat-log-lines';

/**
 * A replay's chat (presentational): each line's time, the sender's hero and name in their team's
 * colour, and what they wrote with its emotes.
 */
@Component({
  selector: 'hrs-chat-log',
  imports: [HeroMinimapIcon, Sprite, TeamTheme],
  templateUrl: './chat-log.html',
  styleUrl: './chat-log.scss',
})
export class ChatLog {
  readonly lines = input.required<readonly ChatLogLine[]>();
}
