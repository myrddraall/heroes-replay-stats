import { describe, expect, it } from 'vitest';
import type { BodyPart } from '@myrddraall/heroes-replay-stats-aether/formats';
import { type BodyInfo, bodyView, valuesOf } from './body';
import { partsOfBody } from '../parts/parts';
import { materialAt, materialsOf } from '../materials/materials';
import { file, korhal, material } from './body-fixtures';

describe("a body's orientation", () => {
  it('turns each material as it says, else its part, else the body (the layer edited over those under it), else facing the camera', () => {
    expect(valuesOf(korhal({})).orientation).toBe('camera');
    expect(valuesOf(korhal({})).axis).toEqual([0, 0, 1]);
    // The body's, from the library under the scene: its parts and materials with it.
    const below: BodyInfo = { ...korhal({}), below: { orientation: 'world', axis: [0, 0.3, 1] } };
    expect(valuesOf(below)).toMatchObject({ orientation: 'world', axis: [0, 0.3, 1] });
    expect(bodyView(below, false, true).origins.orientation).toBe('the library (planet)');
    expect(partsOfBody(below)[0]?.values.orientation).toBe('world');
    expect(materialAt(materialsOf(below), 'clouds')?.values.orientation).toBe('world');
    // Each shows where it is said: the body's name.
    expect(partsOfBody(below)[0]?.origins.orientation).toBe('korhal');
    expect(materialAt(materialsOf(below), 'clouds')?.origins.orientation).toBe('korhal');
    // A part set back to the camera: its materials with it, the overlay's (another part) not.
    const part = korhal({
      orientation: 'world',
      parts: { 'own:sphere-1': { orientation: 'camera' } },
    });
    expect(materialAt(materialsOf(part), 'clouds')?.values.orientation).toBe('camera');
    expect(materialAt(materialsOf(part), 'style:@overlay-1:clouds')?.values.orientation).toBe(
      'world',
    );
    // A material's own say over its part's.
    const own = korhal({
      parts: { 'own:sphere-1': { orientation: 'camera' } },
      materials: { clouds: { orientation: 'world' } },
    });
    expect(materialAt(materialsOf(own), 'clouds')?.values.orientation).toBe('world');
  });

  it("takes its Axis from its data's pole unless set, its Turn 0", () => {
    const pole = [-0.51721, 0.00045, 0.85586] as const;
    const tilted = korhal({});
    const data = tilted.file!;
    const withPole: BodyInfo = {
      ...tilted,
      file: {
        ...data,
        parts: data.parts.map((p) => ({ ...p, mapping: { ...p.mapping, pole } }) as BodyPart),
      },
    };
    expect(valuesOf(withPole)).toMatchObject({ axis: pole, turn: 0 });
    expect(valuesOf({ ...withPole, below: { axis: [0, 0, 1], turn: 30 } })).toMatchObject({
      axis: [0, 0, 1],
      turn: 30,
    });
    expect(bodyView({ ...withPole, below: { turn: 30 } }, false, true).origins.turn).toBe(
      'the library (planet)',
    );
  });

  it('leaves a halo facing the camera when only its body says World, unless set on it', () => {
    const halo: BodyInfo = {
      ...korhal({ orientation: 'world' }),
      file: {
        ...file('world'),
        materials: { clouds: { ...material, blend: 'add' } },
      },
    };
    expect(partsOfBody(halo)[0]?.values.orientation).toBe('camera');
    expect(partsOfBody(halo)[0]?.origins.orientation).toBeUndefined();
    expect(materialAt(materialsOf(halo), 'clouds')).toMatchObject({
      values: { orientation: 'camera' },
      turned: false,
    });
    expect(materialAt(materialsOf(halo), 'clouds')?.origins.orientation).toBe('Sphere 1');
    const set = {
      ...halo,
      settings: {
        orientation: 'world' as const,
        parts: { 'own:sphere-1': { orientation: 'world' as const } },
      },
    };
    expect(materialAt(materialsOf(set), 'clouds')).toMatchObject({
      values: { orientation: 'world' },
      turned: true,
    });
  });
});

describe("a body's variants as its editor stacks them", () => {
  it('puts its variants on under the level edited over its own, and names what over it wins', () => {
    const scene: BodyInfo = {
      ...korhal({}),
      below: { turn: 10, materials: { clouds: { glow: 1 } } },
      variantsBelow: [
        { name: 'the Shield variant', settings: { turn: 20, materials: { clouds: { glow: 3 } } } },
      ],
    };
    expect(valuesOf(scene).turn).toBe(20); // the variant's over its own
    expect(bodyView(scene, false, true).origins.turn).toBe('the Shield variant');
    expect(materialAt(materialsOf(scene), 'clouds')?.origins.glow).toBe('the Shield variant');
    expect(bodyView(scene, false, true).overrides).toEqual({}); // nothing over a scene's
    // Its own settings edited, a variant on over them: what the variant sets is marked overridden.
    const own: BodyInfo = {
      ...korhal({ turn: 5, materials: { clouds: { glow: 2 } } }),
      above: [
        { name: 'the Shield variant', settings: { turn: 20, materials: { clouds: { glow: 3 } } } },
      ],
    };
    expect(valuesOf(own).turn).toBe(5); // the value edited, as edited
    expect(bodyView(own, false, true).overrides.turn).toBe('the Shield variant');
    expect(materialAt(materialsOf(own), 'clouds')?.overrides?.glow).toBe('the Shield variant');
    expect(materialAt(materialsOf(own), 'clouds')?.overrides?.strength).toBeUndefined();
  });
});
