import type { MapPack } from '../model';
import battlefieldOfEternity from './fixtures/battlefield-of-eternity.pack.json';
import punisherArena from './fixtures/punisher-arena.pack.json';

const FIXTURES = {
  'battlefield-of-eternity': battlefieldOfEternity,
  'punisher-arena': punisherArena,
};

/** A real pack.json: Battlefield of Eternity's elements render, or Punisher Arena's three arenas. */
export function fixturePack(name: keyof typeof FIXTURES): MapPack {
  return structuredClone(FIXTURES[name]) as unknown as MapPack;
}
