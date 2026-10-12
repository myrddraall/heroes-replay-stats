import { BreakpointObserver } from '@angular/cdk/layout';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  MapPacksService,
  type MapPack,
  type MapViewModel,
} from '@myrddraall/heroes-replay-stats-map';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { HERO_DATA } from '../../../data/heroes/hero-data';
import { fakeHeroData } from '../../../data/heroes/hero-data.fake';
import { MapExploreStore } from './map-explore.store';

const cut = { rect: [0, 0, 10, 10], atlas: 'standing', at: [0, 0], small: [0, 0] } as const;

/** A pack as small as the store needs: one map layer, a town of two structures, one camp. */
const pack: MapPack = {
  format: 4,
  tool: 'heroes-capture 0.5.0',
  gameBuild: 98348,
  map: {
    id: 'towers-of-doom',
    name: 'Towers of Doom',
    category: 'Battleground',
    validated: true,
    structures: 'elements',
    sizeCells: [184, 190],
    cameraBounds: { left: 10, bottom: 12, right: 174, top: 180 },
  },
  arenas: null,
  layers: [
    {
      id: 'map',
      kind: 'map',
      file: 'map.pmtiles',
      size: [8832, 9120],
      levels: 6,
      tileSize: 512,
      overview: null,
      rate: 1,
      pxPerCell: 48,
      originCell: [0, 0],
    },
  ],
  images: {},
  data: {
    elements: {
      layer: 'map',
      atlases: {},
      structures: [
        {
          id: 1,
          type: 'TownTownHallL2',
          cell: [20, 30],
          owner: 'order',
          town: 1,
          outpost: null,
          core: false,
          states: { standing: cut, rubble: cut },
        },
        {
          id: 2,
          type: 'TownCannonTowerL2',
          cell: [24, 32],
          owner: 'order',
          town: 1,
          outpost: null,
          core: false,
          states: { standing: cut, rubble: cut },
        },
      ],
      outposts: [],
      camps: [{ camp: 1, type: 'SiegeCamp1', cell: [90, 90], states: { spawned: cut } }],
    },
  },
} as unknown as MapPack;

const view = { pack, assets: {} } as unknown as MapViewModel;

function setUp(handset = false) {
  TestBed.configureTestingModule({
    providers: [
      MapExploreStore,
      {
        provide: MapPacksService,
        useValue: {
          open: async () => view,
          catalog: async () => ({ format: 1, maps: [] }),
          fileUrl: (f: string) => f,
        },
      },
      { provide: HERO_DATA, useValue: fakeHeroData },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: handset, breakpoints: {} }) },
      },
    ],
  });
  return TestBed.inject(MapExploreStore);
}

/** The input signals taken up (signalMethod runs as an effect), and the pack's promise settled. */
async function settled() {
  TestBed.tick();
  await new Promise((r) => setTimeout(r, 0));
  TestBed.tick();
}

describe('the explore store', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reads the map from the global store and lists its points of interest and facts', async () => {
    const store = setUp();
    store.load(signal('towers-of-doom'));
    TestBed.tick();
    expect(store.loading()).toBe(true);
    await settled();
    expect(store.map()).toBe(view);
    expect(store.pois().map((t) => [t.id, t.groups.map((g) => g.id)])).toEqual([
      ['order', ['town-1']],
      ['neutral', ['camps']],
    ]);
    expect(store.facts()?.counts.towns).toBe(1);
    expect(store.elementStates()).toEqual({
      'structure-1': 'standing',
      'structure-2': 'standing',
      'camp-1': 'spawned',
    });
  });

  it('picks a point of interest, shows it in a state, and brings it into view from the list', async () => {
    const store = setUp();
    store.load(signal('towers-of-doom'));
    await settled();
    store.select('structure-1');
    expect(store.selectedPoi()?.poi.label).toBe('Fort');
    expect(store.selectedPoi()?.states).toEqual(['standing', 'rubble', 'off']);
    expect(store.centre()).toBeNull();
    store.setSelectedState('rubble');
    expect(store.selectedPoi()?.state).toBe('rubble');
    expect(store.elementStates()['structure-1']).toBe('rubble');
    store.select('camp-1', true);
    const first = store.centre();
    expect(first?.cell).toEqual([90, 90]);
    store.select('camp-1', true);
    expect(store.centre()).not.toBe(first); // asked again: a new request, so the camera moves again
    store.deselect();
    expect(store.selected()).toBeNull();
  });

  it('starts afresh on another map', async () => {
    const store = setUp();
    const id = signal('towers-of-doom');
    store.load(id);
    await settled();
    store.select('structure-1', true);
    store.setSelectedState('off');
    id.set('other');
    TestBed.tick();
    expect(store.selected()).toBeNull();
    expect(store.centre()).toBeNull();
    expect(store.overrides()).toEqual({});
  });

  it('keeps the panels beside the map, and over it on a handset where a pick opens the details', async () => {
    const wide = setUp();
    wide.configurePanels(signal({ position: 'end' as const, mode: 'side' as const }));
    TestBed.tick();
    expect(wide.panelMode()).toBe('side');
    expect(wide.detailsPosition()).toBe('end');
    expect(wide.infoPosition()).toBe('start');
    expect(wide.detailsOpened()).toBe(true);
    expect(wide.infoOpened()).toBe(true);
    wide.togglePanel('details');
    expect(wide.detailsOpened()).toBe(false);
    expect(wide.infoOpened()).toBe(true);
    TestBed.resetTestingModule();
    const small = setUp(true);
    small.configurePanels(signal({ position: 'end' as const, mode: 'side' as const }));
    small.load(signal('towers-of-doom'));
    await settled();
    expect(small.panelMode()).toBe('over');
    expect(small.detailsOpened()).toBe(false);
    expect(small.infoOpened()).toBe(false);
    small.select('structure-1');
    expect(small.detailsOpened()).toBe(true);
    expect(small.infoOpened()).toBe(false);
  });
});
