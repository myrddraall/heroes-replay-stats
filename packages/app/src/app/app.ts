import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Shell } from './shell/shell';

@Component({
  selector: 'hrs-root',
  imports: [Shell],
  template: '<hrs-shell />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
