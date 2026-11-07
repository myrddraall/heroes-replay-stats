import { Component, computed, inject } from '@angular/core';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { HeroMinimapIcon, TalentFrame } from '@myrddraall/heroes-replay-stats-heroes/ui';
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

/** A hero whose first and heroic talents show the talent frame's picked states. */
const TALENT_HERO = 'Valla';

/** The sizes each is shown at, as `font-size`s: the content's size, the frame built around it. */
const SIZES = ['1rem', '2rem', '3.75rem', '6rem'] as const;

/**
 * The frames, the UI area's Components › Frames (`/ui/components/frames`), beside the Components
 * section's side nav: each frame in each of its themes, for a few heroes and at a few sizes.
 */
@Component({
  selector: 'hrs-frames-page',
  imports: [HeroMinimapIcon, TalentFrame, Layout, LayoutItem, ShellSideNav],
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
  /**
   * The talent frame in each of its states: a first-tier talent, a heroic one, each tier empty,
   * and a talent the data has no icon for; the pictured ones once the hero data has loaded.
   */
  protected readonly talentStates = computed(() => {
    const data = this.heroes.data.hasValue() ? this.heroes.data.value() : undefined;
    const images = this.heroes.images();
    const talents = data?.hero(TALENT_HERO)?.talents ?? [];
    const icon = (heroic: boolean) => {
      const talent = talents.find((t) => (t.abilityType === 'Heroic') === heroic);
      return talent ? { picture: images.icon(talent), name: talent.name ?? talent.id } : null;
    };
    const first = icon(false);
    const heroic = icon(true);
    return [
      { state: 'talent', label: 'talent', picture: first?.picture ?? null, name: first?.name ?? '' },
      { state: 'heroic', label: 'heroic', picture: heroic?.picture ?? null, name: heroic?.name ?? '' },
      { state: 'empty', label: 'empty', picture: null, name: '' },
      { state: 'heroic-empty', label: 'heroic-empty', picture: null, name: '' },
      { state: 'talent', label: 'talent (no icon)', picture: 'talents#unknown', name: 'Unknown talent' },
    ];
  });
}
