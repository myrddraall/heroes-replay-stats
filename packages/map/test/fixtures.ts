import { readFileSync } from 'node:fs';
import type { MapPack } from '../src/lib/pack/map-pack';

/** A real pack.json: Battlefield of Eternity's elements render, or Punisher Arena's three arenas. */
export function fixturePack(name: 'battlefield-of-eternity' | 'punisher-arena'): MapPack {
  return JSON.parse(readFileSync(new URL(`fixtures/${name}.pack.json`, import.meta.url), 'utf8'));
}
