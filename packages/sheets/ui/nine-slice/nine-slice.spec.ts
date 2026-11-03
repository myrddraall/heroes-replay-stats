import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SHEET_PICTURES, type PictureStatus, type SheetMeta, type SliceState } from '../../model';
import { NineSlice, sliceTrack, type SliceSource } from './nine-slice';

const META: SheetMeta = {
  v: 1,
  frames: {
    back: { states: { normal: [0, 0, 40, 40] }, cuts: [10, 10, 10, 10], edges: 'tile' },
    border: {
      states: { normal: [0, 40, 30, 30], hover: [0, 70, 30, 30] },
      cuts: [6, 8, 6, 8],
    },
  },
  sets: { card: { back: 'back', front: 'border' } },
};

/** A store with every picture already loaded, and pieces named after their place. */
function fakeStore() {
  const pictures = signal<Record<string, PictureStatus>>({});
  return {
    load: vi.fn((url: string) =>
      pictures.update((p) => p[url] ? p : ({
        ...p,
        [url]: {
          status: 'ready',
          picture: { url: `blob:${url}`, width: 64, height: 128, meta: url.endsWith('.webp') ? META : null },
        },
      })),
    ),
    status: (url: string) => pictures()[url],
    sheetUrl: (sheet: string) => `/sheets/${sheet}.webp`,
    piece: vi.fn(async (_url: string, cut: { rect: readonly number[] }) => `blob:piece-${cut.rect.join('-')}`),
  };
}

@Component({
  imports: [NineSlice],
  template: `<div
    [hrsSlice]="set()"
    [hrsSliceBack]="back()"
    [hrsSliceFront]="front()"
    [sliceState]="state()"
  >
    <p>content</p>
  </div>`,
})
class Host {
  readonly set = signal<string | undefined>(undefined);
  readonly back = signal<SliceSource | undefined>(undefined);
  readonly front = signal<SliceSource | undefined>(undefined);
  readonly state = signal<SliceState | undefined>(undefined);
}

async function setUp() {
  const store = fakeStore();
  TestBed.configureTestingModule({ providers: [{ provide: SHEET_PICTURES, useValue: store }] });
  const fixture = TestBed.createComponent(Host);
  const host = fixture.componentInstance;
  const el = () => fixture.nativeElement.querySelector('div') as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  };
  return { store, fixture, host, el, settle };
}

describe('NineSlice', () => {
  const classesOf = (el: Element) => [...el.classList].filter((c) => !c.startsWith('ng-'));

  it("draws a set's frames around the content: the back first, the content, the front last", async () => {
    const { host, el, settle, store } = await setUp();
    host.set.set('ui#card');
    await settle();
    expect(store.load).toHaveBeenCalledWith('/sheets/ui.webp');
    const children = [...el().children];
    expect(children.map(classesOf)).toEqual([['layer', 'layer--back'], ['content'], ['layer', 'layer--front']]);
    expect(children[1]!.querySelector('p')?.textContent).toBe('content');
    for (const layer of [children[0]!, children[2]!]) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.querySelectorAll('.part')).toHaveLength(9);
    }
  });

  it('pads the content in to the front frame, or else the back, as its pad says', async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    await settle();
    expect(el().style.padding).toBe('6px 8px');

    host.set.set(undefined);
    host.back.set({ picture: { src: '/art/panel.png' }, cuts: [16, 12, 16, 12] });
    await settle();
    expect(el().style.padding).toBe('16px 12px');

    host.back.set({ picture: { src: '/art/panel.png' }, cuts: [16, 12, 16, 12], pad: 4 });
    await settle();
    expect(el().style.padding).toBe('20px 16px');

    host.back.set({ picture: { src: '/art/panel.png' }, cuts: [16, 12, 16, 12], pad: false });
    await settle();
    expect(el().style.padding).toBe('');
  });

  it('hands each part its pieces for every state', async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    await settle();
    const parts = el().querySelectorAll<HTMLElement>('.layer--front .part');
    const topLeft = parts[0]!;
    expect(topLeft.style.getPropertyValue('--hrs-slice-normal')).toBe('url("blob:piece-0-40-8-6")');
    expect(topLeft.style.getPropertyValue('--hrs-slice-hover')).toBe('url("blob:piece-0-70-8-6")');

    const backTop = el().querySelectorAll<HTMLElement>('.layer--back .part')[1]!;
    expect(backTop.style.getPropertyValue('--hrs-slice-repeat')).toBe('repeat no-repeat');
    expect(backTop.style.getPropertyValue('--hrs-slice-size')).toBe('20px 100%');
  });

  it('takes a frame given in the template, and drops a layer whose frame goes', async () => {
    const { host, el, settle } = await setUp();
    host.back.set({ picture: { src: '/art/panel.png' }, cuts: [16, 16, 16, 16], mirror: 'x', tint: 'red' });
    await settle();
    const back = el().querySelector('.layer--back') as HTMLElement;
    expect(back.classList).toContain('layer--tint');
    expect(back.style.getPropertyValue('--hrs-slice-tint')).toBe('red');
    expect((back.children[2] as HTMLElement).style.scale).toBe('-1 1');

    host.back.set(undefined);
    await settle();
    expect(el().querySelector('.layer')).toBeNull();
    expect(el().querySelector('.content p')?.textContent).toBe('content');
  });

  it('keeps the element its own stacking context, and shows a state the CSS can’t see', async () => {
    const { host, el, settle } = await setUp();
    host.set.set('ui#card');
    host.state.set('selected');
    await settle();
    expect(el().style.isolation).toBe('isolate');
    expect(el().getAttribute('data-hrs-slice-state')).toBe('selected');
  });
});

describe('sliceTrack', () => {
  it('keeps the corners their size, and shares a smaller element between them in proportion', () => {
    expect(sliceTrack([8, 24])).toBe('min(8px, calc(100% * 0.25)) 1fr min(24px, calc(100% * 0.75))');
    expect(sliceTrack([0, 0])).toBe('0px 1fr 0px');
  });
});
