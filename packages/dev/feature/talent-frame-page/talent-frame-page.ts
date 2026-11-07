import { Component, computed, inject } from '@angular/core';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { TalentFrame } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { ShellSideNav } from '@myrddraall/heroes-replay-stats-shell/feature';
import { SHOWCASE_SIZES } from '../../model';
import { Showcase, ShowcaseItem, ShowcaseRow, SideNavPage } from '../../ui';

/** A hero whose first and heroic talents show the talent frame's picked states. */
const TALENT_HERO = 'Valla';

/**
 * The talent frame, the UI area's Components › Frames › Talent frame
 * (`/ui/components/frames/talent`): in each of its states, and at a few sizes.
 */
@Component({
  selector: 'hrs-talent-frame-page',
  imports: [ShellSideNav, Showcase, ShowcaseItem, ShowcaseRow, SideNavPage, TalentFrame],
  templateUrl: './talent-frame-page.html',
  styleUrl: './talent-frame-page.scss',
})
export class TalentFramePage {
  private readonly heroes = inject(LatestHeroData);
  protected readonly sizes = SHOWCASE_SIZES;
  /**
   * The talent frame in each of its states: a first-tier talent, a heroic one, each tier empty,
   * and a talent the data has no icon for; the pictured ones once the hero data has loaded.
   */
  protected readonly states = computed(() => {
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
