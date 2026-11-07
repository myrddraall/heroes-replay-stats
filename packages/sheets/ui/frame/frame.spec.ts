import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FrameElement } from './frame';
import { FrameBack, FrameFront } from './frame-layer';

@Component({
  imports: [FrameElement, FrameBack, FrameFront],
  template: `<hrs-frame [state]="state()">
    <span hrsFrameBack class="back"></span>
    <span hrsFrameBack="locked" class="back-locked"></span>
    <span class="content">icon</span>
    <span hrsFrameFront class="front"></span>
    <span hrsFrameFront="chosen, chosen-locked" class="front-chosen"></span>
  </hrs-frame>`,
})
class Host {
  readonly state = signal<string | null>(null);
}

describe('hrs-frame', () => {
  it("shows each slot's layers for its state, or the slot's default, and reflects the state", async () => {
    const fixture = TestBed.createComponent(Host);
    const el: HTMLElement = fixture.nativeElement;
    const shown = () =>
      ['back', 'back-locked', 'front', 'front-chosen'].filter(
        (c) => el.querySelector<HTMLElement>(`.${c}`)!.style.display !== 'none',
      );
    await fixture.whenStable();
    expect(shown()).toEqual(['back', 'front']);
    expect(el.querySelector('hrs-frame')!.hasAttribute('state')).toBe(false);

    fixture.componentInstance.state.set('chosen');
    await fixture.whenStable();
    expect(shown()).toEqual(['back', 'front-chosen']);
    expect(el.querySelector('hrs-frame')!.getAttribute('state')).toBe('chosen');

    fixture.componentInstance.state.set('locked');
    await fixture.whenStable();
    expect(shown()).toEqual(['back-locked', 'front']);

    fixture.componentInstance.state.set('chosen-locked');
    await fixture.whenStable();
    expect(shown()).toEqual(['back', 'front-chosen']);
  });

  it('keeps its layers out of reach of screen readers and clicks, the content in', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.back')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector<HTMLElement>('.front')!.style.pointerEvents).toBe('none');
    expect(el.querySelector('.content')!.hasAttribute('aria-hidden')).toBe(false);
  });
});
