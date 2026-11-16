import { Component, computed, inject } from '@angular/core';
import { TINT_PRESETS } from '@myrddraall/heroes-replay-stats-aether';
import {
  GRADE_KINDS,
  OBJECT_TINT_KINDS,
  type TintKind,
  type TintLayer,
} from '@myrddraall/heroes-replay-stats-aether/tints';
import { type AddedItem, AddedList } from '../controls/added-list';
import { PropertySection } from '../controls/property-section';
import { SplitButton, type SplitOption } from '../controls/split-button';
import { Editor } from '../editing/editor';
import {
  adjustmentKey,
  adjustmentsKey,
  ADJUSTMENTS_TITLE,
  GRADING_TITLE,
} from '../materials/material-views';
import { TintSettings } from './tint-settings';
import { TINT_KIND_ICONS, TINT_KIND_LABELS, tintLabel } from './tint-rows';

/** Kinds of colour adjustment, as offered to add. */
const offered = (kinds: readonly TintKind[]): readonly SplitOption[] =>
  kinds.map((id) => ({ id, label: TINT_KIND_LABELS[id], icon: TINT_KIND_ICONS[id] }));
const OBJECT_KINDS = offered(OBJECT_TINT_KINDS);
const GRADING_KINDS = offered(GRADE_KINDS);

/**
 * The colour adjustments of what is selected in the tree (container, on the `Editor` in effect):
 * their category's (a button to add one of each kind, and those there, each a way to it in the
 * tree, the level's own taken out), or one of them's settings (one added under the level edited:
 * where, its switch in the tree). A scene's are its grading: its kinds, the theme's colours.
 */
@Component({
  selector: 'forge-adjustments-panel',
  imports: [AddedList, PropertySection, SplitButton, TintSettings],
  templateUrl: './adjustments-panel.html',
  styleUrl: '../panel/body-panel.scss',
})
export class AdjustmentsPanel {
  protected readonly editor = inject(Editor);
  protected readonly view = computed(() => this.editor.adjustmentsAt(this.editor.selected()));
  protected readonly grading = computed(() => !!this.view()?.grading);
  protected readonly title = computed(() => (this.grading() ? GRADING_TITLE : ADJUSTMENTS_TITLE));
  protected readonly kinds = computed(() => (this.grading() ? GRADING_KINDS : OBJECT_KINDS));
  /** The theme's colours (its presets that have one). */
  protected readonly themes: readonly { value: string; label: string }[] = inject(TINT_PRESETS)
    .filter((p) => p.token)
    .map((p) => ({ value: p.id, label: p.label }));
  protected readonly items = computed((): readonly AddedItem[] => {
    const v = this.view();
    return (v?.rows ?? []).map((r) => ({
      key: adjustmentKey(v!.owner, r.tint.id),
      label: tintLabel(r.tint),
      icon: TINT_KIND_ICONS[r.tint.kind],
      ...(r.from !== undefined ? { detail: r.from } : {}),
      removable: r.from === undefined,
    }));
  });

  /** One of a kind added after the level's own, and shown. */
  protected add(kind: string): void {
    const v = this.view();
    if (!v) return;
    const before = new Set(v.rows.map((r) => r.tint.id));
    const theme = this.themes[0]?.value;
    this.editor.editAdjustments(this.editor.selected(), {
      kind: 'add',
      tint: kind as TintKind,
      ...(theme ? { theme } : {}),
    });
    const added = this.editor.adjustmentsAt(adjustmentsKey(v.owner))?.rows.find(
      (r) => !before.has(r.tint.id),
    );
    if (added) this.show(adjustmentKey(v.owner, added.tint.id));
  }

  /** One of them selected in the tree, what it is under unfolded to it. */
  protected show(key: string): void {
    const owner = this.view()?.owner;
    this.editor.showAdded(key);
    if (!owner) return;
    const shown = (k: string) => this.editor.rows().some((r) => r.key === k);
    if (!shown(adjustmentsKey(owner))) this.editor.toggleExpanded(owner);
    if (!shown(key)) this.editor.toggleExpanded(adjustmentsKey(owner));
  }

  protected remove(key: string): void {
    const id = this.view()?.rows.find(
      (r) => adjustmentKey(this.view()!.owner, r.tint.id) === key,
    )?.tint.id;
    if (id) this.editor.editAdjustments(key, { kind: 'remove', id });
  }

  protected change(tint: TintLayer): void {
    this.editor.editAdjustments(this.editor.selected(), { kind: 'change', tint });
  }

  protected resetSwitch(id: string): void {
    this.editor.editAdjustments(this.editor.selected(), { kind: 'reset-switch', id });
  }
}
