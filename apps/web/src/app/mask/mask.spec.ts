import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Mask, type MaskSource } from './mask';

@Component({
  imports: [Mask],
  template: `<div [hrsMask]="source()" [maskFade]="fade()" [maskFit]="fit()"></div>`,
})
class One {
  readonly source = signal<MaskSource>('fade-bottom');
  readonly fade = signal(0.25);
  readonly fit = signal<'contain' | 'cover' | 'fill'>('contain');
}

@Component({
  imports: [Mask],
  template: `<svg width="0" height="0" aria-hidden="true">
      <mask #a></mask>
      <mask #b></mask>
    </svg>
    <div [hrsMask]="a"></div>
    <div [hrsMask]="b"></div>`,
})
class SvgMasks {}

@Component({
  imports: [Mask],
  template: `<div hrsMask="spotlight"></div>
    <div hrsMask="circle"></div>`,
})
class Spotlights {}

async function one() {
  const fixture = TestBed.createComponent(One);
  await fixture.whenStable();
  const mask = fixture.debugElement.query(By.directive(Mask)).injector.get(Mask);
  return { fixture, host: fixture.componentInstance, mask };
}

describe('Mask', () => {
  it('builds a preset, and its fade follows maskFade', async () => {
    const { fixture, host, mask } = await one();
    expect(mask.mask()).toBe('linear-gradient(to top, transparent, #000 25%)');

    host.fade.set(0.5);
    await fixture.whenStable();
    expect(mask.mask()).toBe('linear-gradient(to top, transparent, #000 50%)');
  });

  it('fits an image path as maskFit says', async () => {
    const { fixture, host, mask } = await one();
    host.source.set('assets/hex.svg');
    await fixture.whenStable();
    expect(mask.mask()).toBe('url("assets/hex.svg") center / contain no-repeat');

    host.fit.set('cover');
    await fixture.whenStable();
    expect(mask.mask()).toBe('url("assets/hex.svg") center / cover no-repeat');

    host.fit.set('fill');
    await fixture.whenStable();
    expect(mask.mask()).toBe('url("assets/hex.svg") center / 100% 100% no-repeat');
  });

  it('passes any other CSS mask value through', async () => {
    const { fixture, host, mask } = await one();
    host.source.set('linear-gradient(45deg, #000 40%, transparent)');
    await fixture.whenStable();
    expect(mask.mask()).toBe('linear-gradient(45deg, #000 40%, transparent)');
  });

  it('names an SVG <mask> by an id of its own', async () => {
    const fixture = TestBed.createComponent(SvgMasks);
    await fixture.whenStable();
    const [a, b] = fixture.debugElement.queryAll(By.directive(Mask)).map((d) => d.injector.get(Mask));
    const [maskA, maskB] = fixture.nativeElement.querySelectorAll('mask') as NodeListOf<SVGMaskElement>;
    expect(maskA.id).not.toBe('');
    expect(maskA.id).not.toBe(maskB.id);
    expect(a.mask()).toBe(`url(#${maskA.id})`);
    expect(b.mask()).toBe(`url(#${maskB.id})`);
  });

  it('moves the spotlight with the pointer, and back to the centre when it leaves', async () => {
    const fixture = TestBed.createComponent(Spotlights);
    await fixture.whenStable();
    const [spot, circle] = fixture.nativeElement.querySelectorAll('div') as NodeListOf<HTMLElement>;
    const { left, top } = spot.getBoundingClientRect();

    spot.dispatchEvent(new PointerEvent('pointermove', { clientX: left + 30, clientY: top + 20 }));
    expect(spot.style.getPropertyValue('--mask-x')).toBe('30px');
    expect(spot.style.getPropertyValue('--mask-y')).toBe('20px');

    spot.dispatchEvent(new PointerEvent('pointerleave'));
    expect(spot.style.getPropertyValue('--mask-x')).toBe('');
    expect(spot.style.getPropertyValue('--mask-y')).toBe('');

    circle.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, clientY: 20 }));
    expect(circle.style.getPropertyValue('--mask-x')).toBe('');
  });
});
