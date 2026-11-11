import { describe, expect, it } from 'vitest';
import type { BodySettings } from '@myrddraall/heroes-replay-stats-aether/bodies';
import { korhal } from '../bodies/body-fixtures';
import { type BodyLevel, bodyEdits } from './body-edits';

/** A level kept in a variable: what is set there, the body seen with it. */
function levelOf(settings: BodySettings = {}): BodyLevel & { readonly set: () => BodySettings } {
  let now: BodySettings = settings;
  return {
    get body() {
      return korhal(now);
    },
    change: (change) => {
      now = change(now) ?? {};
    },
    set: () => now,
  };
}

describe('the edits of a body, at the level edited', () => {
  it('switches a material off there, and back to what is under it (nothing set)', () => {
    const l = levelOf();
    bodyEdits.switchMaterial(l, 'clouds', false);
    expect(l.set().materials).toEqual({ clouds: { enabled: false } });
    bodyEdits.switchMaterial(l, 'clouds', true);
    expect(l.set().materials).toBeUndefined();
  });

  it('sets and takes back a material’s settings, and moves a shape in the draw order', () => {
    const l = levelOf();
    bodyEdits.setMaterial(l, 'clouds', { strength: 0.5, glow: 2 });
    bodyEdits.clearMaterial(l, 'clouds', ['glow']);
    expect(l.set().materials).toEqual({ clouds: { strength: 0.5 } });
    const [own, worn] = ['own:sphere-1', 'style:@overlay-1:sphere-1'] as const;
    bodyEdits.moveShape(l, worn, own, false);
    expect(l.set().order).toEqual(['style:@overlay-1:clouds', 'clouds']);
  });

  it('adds a light, named apart, and takes it out again', () => {
    const l = levelOf();
    const light = bodyEdits.addLight(l, 'ambient');
    expect(l.set().added?.map((x) => x.id)).toEqual([light.id]);
    bodyEdits.removeLight(l, light.id);
    expect(l.set().added).toBeUndefined();
  });
});
