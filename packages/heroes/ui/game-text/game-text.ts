import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { gameTextScaling, parseGameText, type GameTextPiece } from '../../model';

/** The game's inline icons this draws, by texture path: each a sheet's picture. */
const ICONS: Readonly<Record<string, string>> = {
  '@UI/StormTalentInTextQuestIcon': 'talents#quest',
};

/**
 * A text in the game's markup, drawn as the game draws it (presentational): its runs in the colours
 * the markup gives (a two-colour run a gradient, top to bottom), its line breaks, its inline icons
 * sized against its 18 high type (an icon it doesn't know is left out), a value's per-level
 * scaling as `(+4% per level)`. Inline, in the type around
 * it. `<hrs-game-text [text]="talent.fullText" />`.
 */
@Component({
  selector: 'hrs-game-text',
  imports: [NgTemplateOutlet, Sprite],
  templateUrl: './game-text.html',
  styleUrl: './game-text.scss',
})
export class GameText {
  readonly text = input.required<string>();
  protected readonly pieces = computed(() => parseGameText(this.text()));
  protected readonly icons = ICONS;
  protected readonly scaling = gameTextScaling;
  /** For the template's `let-` variables. */
  protected readonly asPieces = (pieces: readonly GameTextPiece[]) => pieces;
}
