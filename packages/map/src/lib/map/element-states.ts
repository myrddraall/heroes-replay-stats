import {
  nextState,
  piecesOf,
  type CampShown,
  type ElementKind,
  type ElementShown,
  type StructureShown,
} from '../layers/elements/element-pieces';
import type { MapPack } from '../pack/map-pack';

/** What every structure and every camp shows, unless one was set on its own. */
export interface KindStates {
  readonly structure: StructureShown;
  readonly camp: CampShown;
}

/** Each structure and camp of the pack and what it shows: its own state, or its kind's. */
export function elementStatesOf(
  pack: MapPack,
  kinds: KindStates,
  overrides: Readonly<Record<string, ElementShown>>,
): Record<string, ElementShown> {
  const elements = pack.data.elements;
  if (!elements) return {};
  return Object.fromEntries(
    piecesOf(elements).map((piece) => [piece.key, overrides[piece.key] ?? kinds[piece.kind]]),
  );
}

/** An element's kind, from its key (`structure-<id>`, `camp-<camp>`). */
export function kindOfKey(key: string): ElementKind | null {
  if (key.startsWith('structure-')) return 'structure';
  if (key.startsWith('camp-')) return 'camp';
  return null;
}

/** The state an element steps to when it is clicked: the next one of its kind. */
export function clickedState(key: string, current: ElementShown): ElementShown | null {
  const kind = kindOfKey(key);
  return kind ? nextState(kind, current) : null;
}
