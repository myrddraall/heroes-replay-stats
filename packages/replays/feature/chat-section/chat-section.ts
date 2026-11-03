import { Component, inject } from '@angular/core';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Layout } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ChatLog } from '../../ui';
import { ChatSectionStore } from './chat-section.store';

/** The replay's chat (container): `/matches/<id>/chat`. */
@Component({
  selector: 'hrs-chat-section',
  imports: [ChatLog, Layout, MatProgressBar],
  templateUrl: './chat-section.html',
  providers: [ChatSectionStore],
})
export class ChatSection {
  protected readonly store = inject(ChatSectionStore);
}
