import { Component, computed, inject } from '@angular/core';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { HeroMinimapIcon } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { ShellSideNav } from '@myrddraall/heroes-replay-stats-shell/feature';
import { SHOWCASE_SIZES } from '../../model';
import { Showcase, ShowcaseItem, ShowcaseRow, SideNavPage } from '../../ui';

/** The themes a hero frame takes: each side's, and the user's own on each side. */
const THEMES = [
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'blue-self', label: 'Self on blue' },
  { id: 'red-self', label: 'Self on red' },
] as const;

/** A few heroes to frame, by the id a replay records. */
const HEROES = ['Barbarian', 'Jaina', 'Diablo', 'Murky', 'Abathur'] as const;

/**
 * The hero frame, the UI area's Components › Frames › Hero frame (`/ui/components/frames/hero`):
 * in each of its themes for a few heroes, and at a few sizes.
 */
@Component({
  selector: 'hrs-hero-frame-page',
  imports: [HeroMinimapIcon, ShellSideNav, Showcase, ShowcaseItem, ShowcaseRow, SideNavPage],
  templateUrl: './hero-frame-page.html',
  styleUrl: './hero-frame-page.scss',
})
export class HeroFramePage {
  private readonly heroes = inject(LatestHeroData);
  protected readonly themes = THEMES;
  protected readonly sizes = SHOWCASE_SIZES;
  /** The heroes' icons, once the hero data has loaded; the ones it knows. */
  protected readonly icons = computed(() => {
    const lookup = this.heroes.lookup();
    return HEROES.map((id) => lookup.heroIcon(id)).filter((icon) => icon !== null);
  });
}
