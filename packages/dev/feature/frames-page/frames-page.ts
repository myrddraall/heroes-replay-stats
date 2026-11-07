import { Component, computed, inject } from '@angular/core';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { Layout, LayoutItem } from '@myrddraall/heroes-replay-stats-layout/ui';
import { ShellSideNav } from '@myrddraall/heroes-replay-stats-shell/feature';

/** The themes a hero frame takes: each side's, and the user's own on each side. */
const THEMES = [
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'blue-self', label: 'Self on blue' },
  { id: 'red-self', label: 'Self on red' },
] as const;

/** A few heroes to frame, by the id a replay records. */
const HEROES = ['Barbarian', 'Jaina', 'Diablo', 'Murky', 'Abathur'] as const;

/** The sizes each is shown at, as `font-size`s: the content's size, the frame built around it. */
const SIZES = ['1rem', '2rem', '3.75rem', '6rem'] as const;

/**
 * The frames, the UI area's Components › Frames (`/ui/components/frames`), beside the Components
 * section's side nav: each frame in each of its themes, for a few heroes and at a few sizes.
 */
@Component({
  selector: 'hrs-frames-page',
  imports: [HeroMinimapIcon, Layout, LayoutItem, ShellSideNav],
  templateUrl: './frames-page.html',
  styleUrl: './frames-page.scss',
})
export class FramesPage {
  private readonly heroes = inject(LatestHeroData);
  protected readonly themes = THEMES;
  protected readonly sizes = SIZES;
  /** The heroes' icons, once the hero data has loaded; the ones it knows. */
  protected readonly icons = computed(() => {
    const lookup = this.heroes.lookup();
    return HEROES.map((id) => lookup.heroIcon(id)).filter((icon) => icon !== null);
  });
}
