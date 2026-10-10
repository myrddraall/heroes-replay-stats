import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Layout, type LayoutConstraint } from './layout';
import { provideLayoutConstraints } from './layout-constraints';
import { LayoutItem } from './layout-item';

@Component({
  selector: 'hrs-test-page',
  imports: [Layout, LayoutItem],
  template: `
    <hrs-layout [default]="layoutDefault()">
      <div id="flush" hrsLayoutItem="edge-to-edge"></div>
      <div id="plain"></div>
      <div id="padded" hrsLayoutItem="padded"></div>
      <div id="unsaid" hrsLayoutItem></div>
    </hrs-layout>
  `,
})
class TestPage {
  readonly layoutDefault = input<LayoutConstraint>('constrained');
}

/** A stand-in for the browser's ResizeObserver (jsdom has none): reports one width. */
function observeWidth(width: number): void {
  class FakeResizeObserver {
    constructor(
      private readonly callback: (entries: { contentRect: { width: number } }[]) => void,
    ) {}
    observe(): void {
      this.callback([{ contentRect: { width } }]);
    }
    disconnect(): void {
      // nothing to let go of
    }
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
}

async function render(layoutDefault: LayoutConstraint = 'constrained') {
  const fixture = TestBed.createComponent(TestPage);
  fixture.componentRef.setInput('layoutDefault', layoutDefault);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return { fixture, layout: host.querySelector('hrs-layout') as HTMLElement };
}

describe('the layout', () => {
  const hadObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;

  beforeEach(() => TestBed.configureTestingModule({}));
  afterEach(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = hadObserver;
  });

  it("constrains each child as it says, and the rest as the layout's default", async () => {
    const { layout } = await render();
    const classes = (id: string) => Array.from(layout.querySelector(`#${id}`)!.classList);
    expect(classes('flush')).toEqual(['hrs-layout-item', 'hrs-layout-item--edge-to-edge']);
    expect(classes('padded')).toEqual(['hrs-layout-item', 'hrs-layout-item--padded']);
    expect(classes('unsaid')).toEqual(['hrs-layout-item', 'hrs-layout-item--constrained']);
    expect(classes('plain')).toEqual([]); // styled by the layout's default class
    expect(layout.classList.contains('hrs-layout--default-constrained')).toBe(true);
  });

  it("changes its default for the children that don't say", async () => {
    const { layout } = await render('edge-to-edge');
    expect(layout.classList.contains('hrs-layout--default-edge-to-edge')).toBe(true);
    expect(
      layout.querySelector('#unsaid')!.classList.contains('hrs-layout-item--edge-to-edge'),
    ).toBe(true);
    expect(layout.querySelector('#padded')!.classList.contains('hrs-layout-item--padded')).toBe(
      true,
    );
  });

  it('exposes the injected constraints as custom properties, with the default padding', async () => {
    TestBed.configureTestingModule({
      providers: [provideLayoutConstraints({ maxWidth: 900, padding: 10 })],
    });
    const { layout } = await render();
    expect(layout.style.getPropertyValue('--hrs-layout-max-width')).toBe('900px');
    expect(layout.style.getPropertyValue('--hrs-layout-padding')).toBe('10px');
  });

  it('uses the narrow padding once it measures itself narrower than the breakpoint', async () => {
    observeWidth(500);
    TestBed.configureTestingModule({
      providers: [provideLayoutConstraints({ padding: 24, narrowPadding: 8, narrowBelow: 600 })],
    });
    const { fixture, layout } = await render();
    await fixture.whenStable();
    expect(layout.style.getPropertyValue('--hrs-layout-padding')).toBe('8px');
  });
});
