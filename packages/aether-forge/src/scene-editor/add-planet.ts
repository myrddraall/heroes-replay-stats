import { Component, computed, inject, input, output } from '@angular/core';
import { AssetCatalogStore } from '../library/asset-catalog.store';
import type { PickItem } from '../controls/pick-flyout';
import { SplitButton, type SplitOption } from '../controls/split-button';

const KINDS: Readonly<Record<string, string>> = {
  play: 'Play screen',
  world: 'Flyby world',
  painted: 'Painted',
};

/**
 * A button that puts a planet in a scene, as a planet of its own or a moon (container, on the
 * page's catalog): its flyout lists the planets there are, filtered; the one picked is given
 * (`picked`). Where groups may be put there too (`groups`), its arrow offers them, a flyout of
 * their own (`groupPicked`).
 */
@Component({
  selector: 'forge-add-planet',
  imports: [SplitButton],
  templateUrl: './add-planet.html',
})
export class AddPlanet {
  /** What the button (and its flyout) says: 'Add planet', 'Add moon'. */
  readonly label = input('Add planet');
  /** The groups that may be put there (none: no groups are). */
  readonly groups = input<readonly PickItem[] | null>(null);
  readonly picked = output<string>();
  readonly groupPicked = output<string>();
  private readonly catalog = inject(AssetCatalogStore);

  protected readonly options = computed((): SplitOption[] => {
    const groups = this.groups();
    return [
      {
        id: 'planet',
        label: this.label(),
        icon: 'public',
        pick: {
          title: this.label(),
          icon: 'public',
          items: this.catalog.planets().map((p) => ({
            id: p.id,
            label: p.id,
            caption: KINDS[p.kind],
          })),
        },
      },
      ...(groups
        ? [
            {
              id: 'group',
              label: 'Add group',
              icon: 'workspaces',
              disabled: !groups.length,
              pick: { title: 'Add group', icon: 'workspaces', items: groups },
            },
          ]
        : []),
    ];
  });

  protected pick(picked: { readonly option: string; readonly item: string }): void {
    if (picked.option === 'group') this.groupPicked.emit(picked.item);
    else this.picked.emit(picked.item);
  }
}
