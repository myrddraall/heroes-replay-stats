import { Component, computed, input } from '@angular/core';
import type { LightKind } from '@myrddraall/heroes-replay-stats-aether/lights';

/** One of the lines the view draws of a light selected: how it is drawn, and what it shows. */
interface Guide {
  readonly line: 'solid' | 'faint' | 'dashed';
  readonly says: string;
}

/**
 * What the lines the view draws of a light selected show (presentational), for its kind: solid
 * where it stops reaching, faint where it is half as strong, dashed what it doesn't stop at (a
 * spot's cone where it starts to fade, where an environment light reads the sky). None for an
 * ambient light (it lights all alike: nothing is drawn).
 */
@Component({
  selector: 'forge-light-guides',
  templateUrl: './light-guides.html',
  styleUrl: './light-guides.scss',
})
export class LightGuides {
  readonly kind = input.required<LightKind>();

  protected readonly guides = computed((): readonly Guide[] => {
    const kind = this.kind();
    if (kind === 'ambient') return [];
    return [
      ...(kind === 'directional' || kind === 'point' || kind === 'spot'
        ? [{ line: 'solid' as const, says: 'Where it stops reaching' }]
        : []),
      // (A spot's half lies between where its cone starts to fade and its edge: not drawn.)
      ...(kind === 'spot' ? [] : [{ line: 'faint' as const, says: 'Half as strong' }]),
      ...(kind === 'spot' ? [{ line: 'dashed' as const, says: 'Where its cone starts to fade' }] : []),
      ...(kind === 'environment' ? [{ line: 'dashed' as const, says: 'Where it reads the sky' }] : []),
    ];
  });
}
