import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishedDesignStore } from '../../scenes/play-background/published-design.store';
import { DraftDesignStore } from './draft-design.store';

const red = { colour: '#ff0000', blend: 'color', strength: 1 } as const;

describe('DraftDesignStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [DraftDesignStore] });
  });

  it('starts from what is published, with nothing unsaved', () => {
    TestBed.inject(PublishedDesignStore).publish({
      library: { planets: { korhal: { tint: red } }, styles: {}, sky: {} },
      scenes: {
        settings: { background: { on: false, colour: '#ffffff', blend: 'multiply' } },
        planets: {},
      },
    });
    const draft = TestBed.inject(DraftDesignStore);
    expect(draft.library().planets['korhal']).toEqual({ tint: red });
    expect(draft.unsaved()).toBe(0);
  });

  it('counts each asset, scene, the sky and the colour changed once', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.setLibraryBody('planets', 'korhal', { lighting: 0.5 });
    draft.setLibraryMaterial('styles', 'nexus', 'shield', { glow: 2 });
    draft.setLibrarySkyTint(red);
    draft.setSkyTint('korhal', red);
    expect(draft.unsaved()).toBe(4);
    expect([...draft.unsavedLibraryPlanets()]).toEqual(['korhal']);
    expect([...draft.unsavedLibraryStyles()]).toEqual(['nexus']);
    expect(draft.unsavedLibrarySky()).toBe(true);
    expect([...draft.unsavedScenes()]).toEqual(['korhal']);
  });

  it('is not unsaved once an edit is taken back', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.resetLibraryBody('planets', 'korhal');
    expect(draft.unsaved()).toBe(0);
  });

  it('publishes on save and leaves the site alone until then', () => {
    const published = TestBed.inject(PublishedDesignStore);
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    expect(published.library().planets['korhal']).toBeUndefined();
    draft.save();
    expect(published.library().planets['korhal']).toEqual({ tint: red });
    expect(draft.unsaved()).toBe(0);
  });

  it('goes back to what is published on discard', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tint: red });
    draft.discard();
    expect(draft.library().planets['korhal']).toBeUndefined();
    expect(draft.unsaved()).toBe(0);
  });

  it('counts a material base changed, and keeps it out of the planets', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBaseMaterial('rock', { glow: 2 });
    expect(draft.library().materials).toEqual({ rock: { glow: 2 } });
    expect([...draft.unsavedLibraryMaterials()]).toEqual(['rock']);
    expect(draft.unsaved()).toBe(1);
    draft.clearLibraryBaseMaterial('rock', ['glow']);
    expect(draft.unsaved()).toBe(0);
  });

  it('makes scenes of their own, empty or a copy of another with its planets, resets and deletes them', () => {
    const draft = TestBed.inject(DraftDesignStore);
    const id = draft.createScene();
    expect(id).toBe('scene-1');
    expect(draft.scenes().planets[id]).toEqual({ bodies: [] });
    // A new scene starts saved.
    expect(draft.unsaved()).toBe(0);
    expect(TestBed.inject(PublishedDesignStore).scenes().planets[id]).toEqual({ bodies: [] });
    const korhal = { id: 'korhal', position: [0, 65, 4], radius: 18 } as const;
    draft.setSceneBodies(id, [{ ...korhal, style: 'nexus' }]);
    draft.renameScene(id, '  Home  ');
    draft.setSkyTint(id, red);
    const copy = draft.createScene(
      { id, bodies: draft.scenes().planets[id]!.bodies! },
      'Home copy',
    );
    expect(copy).toBe('scene-2');
    expect(draft.scenes().planets[copy]).toEqual({
      bodies: [{ ...korhal, style: 'nexus' }],
      name: 'Home copy',
      sky: { tint: red },
    });
    draft.resetScene(id);
    expect(draft.scenes().planets[id]).toEqual({ name: 'Home', bodies: [korhal] });
    draft.deleteScene(id);
    expect(draft.scenes().planets[id]).toBeUndefined();
    expect(draft.scenes().planets[copy]?.name).toBe('Home copy');
  });

  it("keeps a scene's own lights when its planets change", () => {
    const draft = TestBed.inject(DraftDesignStore);
    const lamp = { id: 'added-lamp', kind: 'ambient', name: 'Lamp' } as const;
    draft.setSceneLights('play-screen', [lamp]);
    draft.setSceneBodies('play-screen', [{ id: 'korhal', position: [0, 0, 0], radius: 1 }]);
    expect(draft.scenes().planets['play-screen']?.lights).toEqual([lamp]);
  });

  it('keeps a group, and the groups put in a scene, when planets change or the scene is reset', () => {
    const draft = TestBed.inject(DraftDesignStore);
    const group = draft.createGroup();
    const scene = draft.createScene();
    const placed = [{ group, position: [10, 80, 0] as const }];
    draft.setSceneGroups(scene, placed);
    const korhal = { id: 'korhal', position: [0, 0, 0] as const, radius: 1 };
    draft.setSceneBodies(scene, [korhal]);
    draft.setSceneBodies(group, [korhal]);
    expect(draft.scenes().planets[scene]?.groups).toEqual(placed);
    expect(draft.scenes().planets[group]?.group).toBe(true);
    draft.resetScene(scene);
    draft.resetScene(group);
    expect(draft.scenes().planets[scene]?.groups).toEqual(placed);
    expect(draft.scenes().planets[group]?.group).toBe(true);
    // A group deleted: taken out of the scene it was put in.
    draft.deleteScene(group);
    expect(draft.scenes().planets[scene]?.groups).toBeUndefined();
  });

  it("resets a preset to its own (the Play screen to the game's three)", () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setSceneBodies('play-screen', [{ id: 'korhal', position: [0, 0, 0], radius: 1 }]);
    expect(draft.unsaved()).toBe(1);
    draft.resetScene('play-screen');
    expect(draft.scenes().planets['play-screen']).toBeUndefined();
    expect(draft.unsaved()).toBe(0);
  });
});
