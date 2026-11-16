import { InjectionToken } from '@angular/core';

/**
 * Where the game data the exporter wrote is served (the scene, its textures, the planets), ending
 * in `/`. The app provides it (`provideAether`).
 */
export const DATA_URL = new InjectionToken<string>('DATA_URL');
