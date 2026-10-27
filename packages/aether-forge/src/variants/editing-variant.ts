import type { LibraryState } from '@myrddraall/heroes-replay-stats-aether/library';
import {
  type BodySettings,
  withMaterial,
  without,
  withoutMaterial,
} from '@myrddraall/heroes-replay-stats-aether/scenes';
import type { MaterialSettings } from '@myrddraall/heroes-replay-stats-aether/materials';
import type { DraftDesignStore } from '../draft/draft-design.store';
import type { LibraryKind } from '../draft/design-writes';
type Draft = InstanceType<typeof DraftDesignStore>;

/**
 * The draft as an editor of one planet edits it: where one of the planet's variants is edited
 * (`variant`, of `planet`), what it reads and sets of the planet's library settings is the
 * variant's changes (its name as the planet's name), so every edit lands in the variant; anything
 * else, and anything while none is edited, is the draft's own.
 */
export function editingVariant(
  draft: Draft,
  planet: () => string | null,
  variant: () => string | null,
): Draft {
  /** The variant edited, where `kind` and `id` are the planet's whose variant it is. */
  const edited = (kind: LibraryKind, id: string) => {
    const v = variant();
    return kind === 'planets' && v && id === planet() ? v : null;
  };
  const changeSettings = (
    id: string,
    v: string,
    change: (s: BodySettings) => BodySettings | undefined,
  ) => draft.changeVariant(id, v, (x) => ({ ...x, settings: change(x.settings ?? {}) }));
  const overrides = {
    library: (): LibraryState => {
      const l = draft.library();
      const p = planet();
      const v = variant();
      if (!p || !v) return l;
      const settings = l.planets[p]?.variants?.find((x) => x.id === v)?.settings ?? {};
      return { ...l, planets: { ...l.planets, [p]: settings } };
    },
    setLibraryBody: (kind: LibraryKind, id: string, change: Partial<BodySettings>) => {
      const v = edited(kind, id);
      if (!v) return draft.setLibraryBody(kind, id, change);
      const { label, ...rest } = change;
      draft.changeVariant(id, v, (x) => ({
        ...x,
        ...(label !== undefined ? { name: label } : {}),
        settings: { ...x.settings, ...rest },
      }));
    },
    clearLibraryBody: (kind: LibraryKind, id: string, keys: readonly (keyof BodySettings)[]) => {
      const v = edited(kind, id);
      if (!v) return draft.clearLibraryBody(kind, id, keys);
      changeSettings(id, v, (s) => without(s, keys));
    },
    changeLibraryBody: (
      kind: LibraryKind,
      id: string,
      change: (s: BodySettings) => BodySettings | undefined,
    ) => {
      const v = edited(kind, id);
      if (!v) return draft.changeLibraryBody(kind, id, change);
      changeSettings(id, v, (s) => {
        const { label, ...rest } = change(s) ?? {};
        if (label !== undefined) draft.changeVariant(id, v, (x) => ({ ...x, name: label }));
        return rest;
      });
    },
    resetLibraryBody: (kind: LibraryKind, id: string) => {
      const v = edited(kind, id);
      if (!v) return draft.resetLibraryBody(kind, id);
      changeSettings(id, v, () => undefined);
    },
    setLibraryMaterial: (
      kind: LibraryKind,
      id: string,
      name: string,
      change: Partial<MaterialSettings>,
    ) => {
      const v = edited(kind, id);
      if (!v) return draft.setLibraryMaterial(kind, id, name, change);
      changeSettings(id, v, (s) => withMaterial(s, name, change));
    },
    clearLibraryMaterial: (
      kind: LibraryKind,
      id: string,
      name: string,
      keys?: readonly (keyof MaterialSettings)[],
    ) => {
      const v = edited(kind, id);
      if (!v) return draft.clearLibraryMaterial(kind, id, name, keys);
      changeSettings(id, v, (s) => withoutMaterial(s, name, keys));
    },
  };
  return new Proxy(draft, {
    get: (target, prop, receiver) =>
      prop in overrides
        ? overrides[prop as keyof typeof overrides]
        : (Reflect.get(target, prop, receiver) as unknown),
  });
}
