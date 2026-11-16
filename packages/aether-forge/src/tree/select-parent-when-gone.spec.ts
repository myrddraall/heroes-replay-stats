import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { Editor } from '../editing/editor';
import type { TargetKind } from '../bodies/body';
import type { TreeRow } from './scene-tree';
import { parentRowOf, selectParentWhenGone } from './select-parent-when-gone';

const row = (key: string, depth: number, group?: boolean): TreeRow => ({
  key,
  label: key,
  icon: 'circle',
  depth,
  expandable: false,
  expanded: false,
  group,
});

/** An editor with a body, its Lights group and a light in it, its part selectable. */
function editor(selected: string, kind: TargetKind) {
  const rows = signal([
    row('body', 0),
    row('body/lights', 1, true),
    row('light', 2),
    row('part', 1),
  ]);
  const light = signal<object | undefined>(undefined);
  const part = signal<object | undefined>({});
  const sel = signal(selected);
  const fake = {
    rows,
    selected: sel,
    kind: signal(kind),
    light,
    part,
    material: signal(undefined),
    materialView: signal(null),
    select: (key: string) => sel.set(key),
  } as unknown as Editor;
  runInInjectionContext(TestBed.inject(Injector), () => selectParentWhenGone(fake));
  TestBed.tick();
  return { rows, light, part, sel };
}

describe('what is selected taken away', () => {
  it('selects its parent, past a group, once it was there', () => {
    const e = editor('light', 'light');
    // Still loading: left as it is.
    expect(e.sel()).toBe('light');
    e.light.set({});
    TestBed.tick();
    e.light.set(undefined);
    e.rows.set([row('body', 0), row('part', 1)]);
    TestBed.tick();
    expect(e.sel()).toBe('body');
  });

  it('leaves what is still there selected (its rows folded away)', () => {
    const e = editor('part', 'part');
    e.rows.set([{ ...row('body', 0), expandable: true, expanded: false }]);
    TestBed.tick();
    expect(e.sel()).toBe('part');
  });

  it('selects its parent where its row is gone from under it, open (its part taken away)', () => {
    const e = editor('part', 'part');
    e.rows.set([{ ...row('body', 0), expandable: true, expanded: true }, row('light', 1)]);
    TestBed.tick();
    expect(e.sel()).toBe('body');
  });
});

describe('the row selected in place of one taken out', () => {
  it('is its parent, past a group that only folds', () => {
    const rows = [
      row('scene', 0),
      row('scene/lights', 1, true),
      row('scene-light', 2),
      row('body', 1),
      row('body/lights', 2),
      row('light', 3),
      row('light-2', 3),
    ];
    // Its parent, never the row beside it.
    expect(parentRowOf(rows, 'light-2')).toBe('body/lights');
    expect(parentRowOf(rows, 'scene-light')).toBe('scene');
    expect(parentRowOf(rows, 'scene')).toBeNull();
    expect(parentRowOf(rows, 'gone')).toBeNull();
  });
});
