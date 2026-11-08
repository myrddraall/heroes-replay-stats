import { Component, input } from '@angular/core';
import type { SpritePicture } from '@myrddraall/heroes-replay-stats-sheets/model';
import { Frame, FrameBack, FrameFront, Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';

/**
 * A talent's icon in the game's talent frame (GameStatsPanel's QuestIconImageTemplate, as the talent
 * screen's TalentTreeIcon shows it), in one of its states (`state`):
 * - `talent`: a talent picked (TalentTierSelected: Storm_UI_InGame_Leader_Talent_Available)
 * - `heroic`: a heroic talent picked (UltimateTierSelected: …_Talent_Available_Ult)
 * - `empty`: a tier not picked (TalentTierNotAvailable: …_Talent_Unavailable, no icon)
 * - `heroic-empty`: the heroic tier not picked (UltimateTierNotAvailable: …_Ultimate_Unavailable)
 *
 * The icon (`picture`, named by `name`) is the content, 1em square at the frame's `font-size`, and
 * the frame is built around it as the game's is: 68 across for its 40 (14 out each side), its
 * background (Storm_UI_InGame_Leader_Talent_Background) 3 in from that, faint in an empty tier.
 */
@Component({
  selector: 'hrs-talent-frame',
  imports: [FrameBack, FrameFront, Sprite],
  hostDirectives: [{ directive: Frame, inputs: ['state'] }],
  template: `
    <span hrsFrameBack>
      <span class="background">
        <img hrsSprite="talents#background" spriteCover loading="eager" alt="" />
      </span>
    </span>
    <span class="icon">
      @if (picture(); as picture) {
        <img [hrsSprite]="picture" spriteCover [alt]="name()" />
      }
    </span>
    <span hrsFrameFront="talent" class="border">
      <img hrsSprite="talents#talent-frame" spriteCover loading="eager" alt="" />
    </span>
    <span hrsFrameFront="heroic" class="border">
      <img hrsSprite="talents#heroic-frame" spriteCover loading="eager" alt="" />
    </span>
    <span hrsFrameFront="empty" class="border">
      <img hrsSprite="talents#empty-frame" spriteCover loading="eager" alt="" />
    </span>
    <span hrsFrameFront="heroic-empty" class="border">
      <img hrsSprite="talents#heroic-empty-frame" spriteCover loading="eager" alt="" />
    </span>
  `,
  styleUrl: './talent-frame.scss',
})
export class TalentFrame {
  /** The talent's icon, or a sheet's picture by name (`talents#unknown`); none in an empty tier. */
  readonly picture = input<SpritePicture | string | null>(null);
  /** The talent's name, the icon's alt text. */
  readonly name = input('');
}
