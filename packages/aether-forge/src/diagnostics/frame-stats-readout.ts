import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FrameStats } from '@myrddraall/heroes-replay-stats-aether/view';

/** The background's frame stats, small in a corner of the view: its frames are timed while it shows. */
@Component({
  selector: 'forge-frame-stats-readout',
  imports: [DecimalPipe],
  templateUrl: './frame-stats-readout.html',
  styleUrl: './frame-stats-readout.scss',
})
export class FrameStatsReadout {
  protected readonly stats = inject(FrameStats);

  constructor() {
    inject(DestroyRef).onDestroy(this.stats.watch());
  }
}
