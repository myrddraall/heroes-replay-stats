import { Component } from '@angular/core';
import { Shell } from './shell/shell';

@Component({
  selector: 'hrs-root',
  imports: [Shell],
  template: '<hrs-shell />',
})
export class App {}
