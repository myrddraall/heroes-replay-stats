import { Component, input, resource } from '@angular/core';
import { loadPlayScene, PLAY_SCENE_URL } from './play-scene';
import { DEFAULT_MAX_FPS, SceneCanvas } from './scene-canvas';

/**
 * The game's Play screen background (container): its sky, the energy drifting across the horizon,
 * the twinkling stars and the planets, from the scene heroes-capture exports, filling this element. Black
 * until the scene has loaded, or if it can't be.
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
  /** Frames a second at most. */
  readonly maxFps = input(DEFAULT_MAX_FPS);
  /** Whether it shows the vs A.I. look (the screen turned blue, as the game does for vs A.I.). */
  readonly versusAI = input(false);

  protected readonly scene = resource({
    params: () => this.src(),
    loader: ({ params, abortSignal }) => loadPlayScene(params, abortSignal),
  });
}
