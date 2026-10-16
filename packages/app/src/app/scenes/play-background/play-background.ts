import { Component, computed, inject, input, resource } from '@angular/core';
import { BackgroundStore } from './background.store';
import { loadPlayScene, PLAY_SCENE_URL } from './play-scene';
import { SceneCanvas } from './scene-canvas';
import { browserColourParser, rendererTints } from './scene-tints';

/**
 * The game's Play screen background (container): its sky, the energy drifting across the horizon,
 * the twinkling stars and the planets, from the scene heroes-capture exports, filling this element,
 * tinted and drawn as the BackgroundStore says. Black until the scene has loaded, or if it can't be.
 */
@Component({
  selector: 'hrs-play-background',
  imports: [SceneCanvas],
  templateUrl: './play-background.html',
  styleUrl: './play-background.scss',
})
export class PlayBackground {
  /** Where the exported scene is served. */
  readonly src = input(PLAY_SCENE_URL);

  protected readonly store = inject(BackgroundStore);
  protected readonly drawing = this.store.drawing;
  private readonly parse = browserColourParser();
  protected readonly tints = computed(() => rendererTints(this.store.tints(), this.parse));

  protected readonly scene = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlayScene(params, abortSignal),
  });
}
