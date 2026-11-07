import { Component, computed, ElementRef, inject, viewChildren } from '@angular/core';
import { Tooltip } from '@myrddraall/heroes-replay-stats-common/ui';
import { LatestHeroData } from '@myrddraall/heroes-replay-stats-heroes/data';
import { TalentFrame, TalentTooltip } from '@myrddraall/heroes-replay-stats-heroes/ui';
import { ShellSideNav } from '@myrddraall/heroes-replay-stats-shell/feature';
import { afterPageSettles, Showcase, ShowcaseItem, ShowcaseRow, SideNavPage } from '../../ui';

/** A hero whose talents show the talent tooltip's kinds: a plain one, a heroic, a quest. */
const TALENT_HERO = 'Valla';

/** The game's inline quest icon, as a talent's full text gives it. */
const QUEST_ICON = '@UI/StormTalentInTextQuestIcon';

/**
 * The game's talent tooltip, the UI area's Components › Tooltips › Talent tooltip
 * (`/ui/components/tooltips/talent`): `hrs-talent-tooltip` in `hrsTooltip` on a few talents, the
 * first shown when the page opens so its look shows without hovering.
 */
@Component({
  selector: 'hrs-talent-tooltip-page',
  imports: [ShellSideNav, Showcase, ShowcaseItem, ShowcaseRow, SideNavPage, TalentFrame, TalentTooltip, Tooltip],
  templateUrl: './talent-tooltip-page.html',
  styleUrl: './talent-tooltip-page.scss',
})
export class TalentTooltipPage {
  private readonly heroes = inject(LatestHeroData);
  private readonly tooltips = viewChildren(Tooltip);
  private readonly frames = viewChildren(TalentFrame, { read: ElementRef<HTMLElement> });

  /** A first-tier talent, a heroic and a quest, with what their tooltips show; once the data has loaded. */
  protected readonly talents = computed(() => {
    const data = this.heroes.data.hasValue() ? this.heroes.data.value() : undefined;
    const images = this.heroes.images();
    const all = data?.hero(TALENT_HERO)?.talents ?? [];
    const picks = [
      { caption: 'talent', talent: all.find((t) => t.abilityType !== 'Heroic' && !t.fullText?.includes(QUEST_ICON)) },
      { caption: 'heroic', talent: all.find((t) => t.abilityType === 'Heroic' && t.level === 10) },
      { caption: 'quest', talent: all.find((t) => t.fullText?.includes(QUEST_ICON)) },
    ];
    return picks.flatMap(({ caption, talent }) =>
      talent
        ? [
            {
              caption,
              state: caption === 'heroic' ? 'heroic' : 'talent',
              picture: images.icon(talent),
              name: talent.name ?? talent.id,
              details: `Level ${talent.level}`,
              text: talent.fullText,
            },
          ]
        : [],
    );
  });

  constructor() {
    afterPageSettles(
      () => this.frames()[0]?.nativeElement,
      () => this.tooltips()[0]?.show(),
    );
  }
}
