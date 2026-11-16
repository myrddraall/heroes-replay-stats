import { linkingShown } from '../panel/panel-pages';
import type { SetPlanet } from '@myrddraall/heroes-replay-stats-aether/planet-sets';
import { computed } from '@angular/core';
import type { WithTree } from './asset-editor.store';

/** The stage as the light selected lights it. */
export function stageLightingViews(store: WithTree) {
  /**
   * What of the stage the light selected lights: of the planet open, what it reaches (none: all
   * of it); whether it lights its moons (lighting down, or the whole scene). None: no light of the
   * planet's selected, or its Linking page not shown.
   */
  const reach = computed(() => {
    const own = store.linking()?.find((l) => l.own);
    const light = store.light();
    // (Shown on its Linking page only, as in a scene.)
    if (!own || !light || !linkingShown(store._ui.panelPages())) return null;
    return {
      own: own.lit ? (own.reach ?? null) : undefined,
      moons: light.light.enabled && (light.down || light.out === 'scene'),
    };
  });
  /**
   * The stage's planets, what the light selected doesn't light dimmed: the planet open's parts and
   * materials it doesn't reach (all of it, where the light is off), its moons where it doesn't
   * light them.
   */
  const stageLit = computed((): SetPlanet[] => {
    const planets = store.stagePlanets();
    const lit = reach();
    if (!lit) return planets;
    return planets.map((p, i) => {
      if (i > 0) return lit.moons ? p : { ...p, dimmed: true };
      if (lit.own === undefined) return { ...p, dimmed: true };
      return lit.own ? { ...p, dimmedOutside: lit.own } : p;
    });
  });
  return {
    stageLit,
    /** Whether anything of the stage is drawn dimmed. */
    stageDimming: computed(() => stageLit().some((p) => p.dimmed || p.dimmedOutside)),
  };
}
