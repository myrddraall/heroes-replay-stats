import { Component, input } from '@angular/core';
import { ItemList, ItemTemplate } from '@myrddraall/heroes-replay-stats-data-views/ui';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { TeamTheme } from '../team-theme/team-theme';
import type { ChatLogLine } from './chat-log-lines';

/**
 * A replay's chat (presentational): each line's time, the sender's hero and name in their team's
 * colour, and what they wrote with its emotes.
 */
@Component({
  selector: 'hrs-chat-log',
  imports: [HeroMinimapIcon, ItemList, ItemTemplate, Sprite, TeamTheme],
  templateUrl: './chat-log.html',
  styleUrl: './chat-log.scss',
})
export class ChatLog {
  readonly lines = input.required<readonly ChatLogLine[]>();

  protected readonly byKey = (line: ChatLogLine) => line.key;
}
