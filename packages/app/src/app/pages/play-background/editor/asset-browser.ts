import { Component, computed, inject } from '@angular/core';
import { RANDOM_SCENE } from '../../../scenes/play-background/background-design';
import { overlayName } from '../../../scenes/play-background/created-overlays';
import { DraftDesignStore } from '../draft-design.store';
import { AssetCatalogStore } from './asset-catalog.store';
import { AssetList, type BrowserItem } from './asset-list';
import { Editor } from './editor';
import { EditorUiStore } from './editor-ui.store';
import { openKey, type OpenKind, parseOpen } from './open-target';

const KIND_LABELS: Readonly<Record<string, string>> = {
  play: 'Play screen',
  world: 'Flyby world',
  painted: 'Painted',
};

const ICONS: Readonly<Record<OpenKind, string>> = {
  scene: 'landscape',
  group: 'workspaces',
  planet: 'public',
  style: 'style',
  material: 'texture',
  particle: 'grain',
  sky: 'blur_on',
};

/**
 * The library's list (container, on the page's catalog, draft and UI stores and the `Editor` in
 * effect): the things of the kind chosen, flat, searched by name or where they are used; one
 * selected (shown, its information beside), or opened in the editor. It starts on the kind of
 * what is open.
 */
@Component({
  selector: 'hrs-asset-browser',
  imports: [AssetList],
  templateUrl: './asset-browser.html',
})
export class AssetBrowser {
  protected readonly catalog = inject(AssetCatalogStore);
  private readonly draft = inject(DraftDesignStore);
  private readonly ui = inject(EditorUiStore);
  private readonly editor = inject(Editor);

  protected readonly current = computed(() => openKey(this.editor.opened()));
  protected readonly icon = computed(() => ICONS[this.catalog.type()]);

  protected readonly items = computed((): BrowserItem[] => {
    const c = this.catalog;
    const d = this.draft;
    const type = c.type();
    const key = (id: string) => openKey({ kind: type, id });
    const all = ((): BrowserItem[] => {
      switch (type) {
        case 'scene':
          return c.scenes().map((s) => ({
            key: key(s.id),
            label: s.label,
            caption: s.shows !== s.label ? s.shows : undefined,
            unsaved: d.unsavedScenes().has(s.id),
            // The random sets': the next set drawn, without leaving and coming back.
            ...(s.id === RANDOM_SCENE ? { action: { icon: 'casino', label: 'New set' } } : {}),
          }));
        case 'group':
          return c.groups().map((g) => ({
            key: key(g.id),
            label: g.label,
            caption: g.shows !== g.label ? g.shows : undefined,
            unsaved: d.unsavedScenes().has(g.id),
          }));
        case 'planet':
          return c.planets().map((p) => ({
            key: key(p.id),
            // As renamed in the library (its id beside), else its id.
            label: d.library().planets[p.id]?.label ?? p.id,
            caption: d.library().planets[p.id]?.label
              ? `${p.id} · ${KIND_LABELS[p.kind]}`
              : KIND_LABELS[p.kind],
            unsaved: d.unsavedLibraryPlanets().has(p.id),
          }));
        case 'style':
          // Grouped by what they are worn on: planets', then the sky's.
          return c.overlays().map((o) => ({
            key: key(o.id),
            label: d.library().styles[o.id]?.label ?? o.label ?? overlayName(d.library(), o.id),
            caption: o.made ? 'Made here' : d.library().styles[o.id]?.label ? o.id : undefined,
            unsaved: d.unsavedLibraryStyles().has(o.id),
            group: o.kind === 'sky' ? 'Sky' : 'Planet',
          }));
        case 'material':
          return c.materials().map((m) => ({
            key: key(m.name),
            label: m.label,
            caption: `${m.name} · ${m.uses.map((u) => (u.kind === 'sky' ? 'sky' : u.id)).join(', ')}`,
            unsaved: d.unsavedLibraryMaterials().has(m.name),
          }));
        case 'particle':
          return c.particles().map((p) => ({ key: key(p.id), label: p.id, caption: p.material }));
        case 'sky':
          return c.skies().map((s) => ({
            key: key(s.id),
            label: s.label,
            unsaved: d.unsavedLibrarySky(),
          }));
      }
    })();
    const query = c.query().trim().toLowerCase();
    return query
      ? all.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            (item.caption?.toLowerCase().includes(query) ?? false),
        )
      : all;
  });

  /** Clicked: selected; clicked again soon after (a double-click), opened. */
  protected clicked(key: string): void {
    if (this.ui.clickedAgain(key)) this.open(key);
    else this.select(key);
  }

  /** Selected: shown in the background, its information beside, the list kept. */
  protected select(key: string): void {
    this.ui.show(parseOpen(key));
  }

  /** Opened: its tree in place of the list, its controls beside. */
  protected open(key: string): void {
    this.ui.open(parseOpen(key));
  }

  /** An item's action: the random sets' draws the next set, shown. */
  protected act(key: string): void {
    const target = parseOpen(key);
    if (target.kind !== 'scene' || target.id !== RANDOM_SCENE) return;
    this.catalog.nextRandomSet();
    this.ui.show(target);
  }
}
