import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Glyph } from '../glyph/glyph';
import { HexFrame } from '../hex-frame/hex-frame';
import { SquareFrame } from '../square-frame/square-frame';
import { CircleFrame } from './circle-frame';

@Component({
  imports: [CircleFrame, HexFrame, SquareFrame, Glyph],
  template: `
    <hrs-circle-frame [state]="state()"><hrs-glyph [styled]="styled()">M</hrs-glyph></hrs-circle-frame>
    <hrs-hex-frame [state]="state()"><hrs-glyph>A</hrs-glyph></hrs-hex-frame>
    <hrs-square-frame [state]="state()"><hrs-glyph>Q</hrs-glyph></hrs-square-frame>
  `,
})
class Host {
  readonly state = signal<string | null>(null);
  readonly styled = signal<'base' | null>(null);
}

describe('shaped frames', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it('lay out their content inside, over the background, their art hidden from screen readers', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const circle = el.querySelector('hrs-circle-frame')!;
    expect(circle.querySelector('.inside__content hrs-glyph')!.textContent!.trim()).toBe('M');
    expect(circle.querySelector('.ring')!.getAttribute('aria-hidden')).toBe('true');
    // the hexagon's rim is drawn over its inside
    const hex = el.querySelector('hrs-hex-frame')!;
    const inside = hex.querySelector('.inside')!;
    const rim = hex.querySelector('.rim')!.parentElement!;
    expect(inside.compareDocumentPosition(rim) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rim.getAttribute('aria-hidden')).toBe('true');
    // and the square's border over its inside
    const square = el.querySelector('hrs-square-frame')!;
    expect(square.querySelector('.inside__content hrs-glyph')!.textContent!.trim()).toBe('Q');
    const border = square.querySelector('.border')!;
    const squareInside = square.querySelector('.inside')!;
    expect(
      squareInside.compareDocumentPosition(border) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(border.getAttribute('aria-hidden')).toBe('true');
  });

  it('reflect their state, which leaves their content as it was set', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.styled.set('base');
    await fixture.whenStable();
    const glyph = () => fixture.nativeElement.querySelector('hrs-circle-frame .glyph') as HTMLElement;
    expect(glyph().classList).toContain('hrs-styled--base');
    fixture.componentInstance.state.set('selected');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('hrs-circle-frame').getAttribute('state')).toBe(
      'selected',
    );
    expect(glyph().classList).toContain('hrs-styled--base');
  });
});
