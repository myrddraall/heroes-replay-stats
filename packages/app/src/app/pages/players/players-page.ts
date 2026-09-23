import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyState } from '../empty-state';

@Component({
  selector: 'hrs-players-page',
  imports: [EmptyState],
  template: `
    <h1>Players</h1>
    <hrs-empty-state icon="groups" title="Nobody here yet">
      Players appear once replays are imported. Mark yourself in any replay and your games are
      highlighted everywhere.
    </hrs-empty-state>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayersPage {}
