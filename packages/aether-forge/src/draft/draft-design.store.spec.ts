import type { TintLayer } from '@myrddraall/heroes-replay-stats-aether/tints';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublishedDesignStore } from '@myrddraall/heroes-replay-stats-aether/design';
import { GAME_CAMERA, primaryCameraOf } from '@myrddraall/heroes-replay-stats-aether/scenes';
import { DraftDesignStore } from './draft-design.store';

const red: TintLayer = { id: 'red', kind: 'colour', colour: '#ff0000', blend: 'color', strength: 1 };

describe('DraftDesignStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [DraftDesignStore] });
  });

  it('starts from what is published, with nothing unsaved', () => {
    TestBed.inject(PublishedDesignStore).publish({
      library: { planets: { korhal: { tints: [red] } }, styles: {}, sky: {} },
      scenes: { planets: {} },
    });
    const draft = TestBed.inject(DraftDesignStore);
    expect(draft.library().planets['korhal']).toEqual({ tints: [red] });
    expect(draft.unsaved()).toBe(0);
  });

  it('counts each asset, scene and the sky changed once', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tints: [red] });
    draft.setLibraryBody('planets', 'korhal', { lighting: 0.5 });
    draft.setLibraryMaterial('styles', 'nexus', 'shield', { glow: 2 });
    draft.setLibrarySkyTints({ tints: [red] });
    draft.setSkyTints('korhal', { tints: [red] });
    expect(draft.unsaved()).toBe(4);
    expect([...draft.unsavedLibraryPlanets()]).toEqual(['korhal']);
    expect([...draft.unsavedLibraryStyles()]).toEqual(['nexus']);
    expect(draft.unsavedLibrarySky()).toBe(true);
    expect([...draft.unsavedScenes()]).toEqual(['korhal']);
  });

  it('is not unsaved once an edit is taken back', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tints: [red] });
    draft.resetLibraryBody('planets', 'korhal');
    expect(draft.unsaved()).toBe(0);
  });

  it('publishes on save and leaves the site alone until then', () => {
    const published = TestBed.inject(PublishedDesignStore);
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tints: [red] });
    expect(published.library().planets['korhal']).toBeUndefined();
    draft.save();
    expect(published.library().planets['korhal']).toEqual({ tints: [red] });
    expect(draft.unsaved()).toBe(0);
  });

  it('goes back to what is published on discard', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setLibraryBody('planets', 'korhal', { tints: [red] });
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
    draft.setSkyTints(id, { tints: [red] });
    const copy = draft.createScene(
      { id, bodies: draft.scenes().planets[id]!.bodies! },
      'Home copy',
    );
    expect(copy).toBe('scene-2');
    expect(draft.scenes().planets[copy]).toEqual({
      bodies: [{ ...korhal, style: 'nexus' }],
      name: 'Home copy',
      sky: { tints: [red] },
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

  it("keeps a scene's own variants when its planets change", () => {
    const draft = TestBed.inject(DraftDesignStore);
    const variant = draft.createSceneVariant('play-screen', 'Storm');
    draft.setSceneBodies('play-screen', [{ id: 'korhal', position: [0, 0, 0], radius: 1 }]);
    expect(draft.scenes().planets['play-screen']?.sceneVariants?.map((v) => v.id)).toEqual([
      variant,
    ]);
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

  it("keeps a scene's cameras and its primary, and drops a primary that is taken out", () => {
    const draft = TestBed.inject(DraftDesignStore);
    const scene = draft.createScene();
    const close = {
      id: 'camera-close',
      name: 'Close',
      eye: [0, -10, 0],
      forward: [0, 1, 0],
      fovY: 30,
    } as const;
    draft.setSceneCameras(scene, [close]);
    draft.setPrimaryCamera(scene, close.id);
    draft.setSceneBodies(scene, [{ id: 'korhal', position: [0, 0, 0], radius: 1 }]);
    draft.resetScene(scene);
    expect(draft.scenes().planets[scene]?.cameras).toEqual([close]);
    expect(primaryCameraOf(draft.scenes().planets[scene])).toEqual({
      eye: close.eye,
      forward: close.forward,
      fovY: close.fovY,
    });
    // Back to the game's camera, as named or as its camera is taken out.
    draft.setPrimaryCamera(scene, GAME_CAMERA);
    expect(draft.scenes().planets[scene]?.primaryCamera).toBeUndefined();
    draft.setPrimaryCamera(scene, close.id);
    draft.setSceneCameras(scene, []);
    expect(draft.scenes().planets[scene]?.cameras).toBeUndefined();
    expect(draft.scenes().planets[scene]?.primaryCamera).toBeUndefined();
  });

  it("resets a preset to its own (the Play screen to the game's three)", () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setSceneBodies('play-screen', [{ id: 'korhal', position: [0, 0, 0], radius: 1 }]);
    expect(draft.unsaved()).toBe(1);
    draft.resetScene('play-screen');
    expect(draft.scenes().planets['play-screen']).toBeUndefined();
    expect(draft.unsaved()).toBe(0);
  });

  it('anchors a scene’s sky or the library’s against the camera, and takes it back', () => {
    const draft = TestBed.inject(DraftDesignStore);
    draft.setSkyAnchor(null, 'position');
    draft.setSkyAnchor('play-screen', 'camera');
    expect(draft.library().sky.anchor).toBe('position');
    expect(draft.scenes().planets['play-screen']?.sky?.anchor).toBe('camera');
    draft.setSkyAnchor('play-screen', undefined);
    expect(draft.scenes().planets['play-screen']?.sky).toBeUndefined();
    draft.setSkyAnchor(null, undefined);
    expect(draft.library().sky).toEqual({});
    expect(draft.unsaved()).toBe(0);
  });
});
