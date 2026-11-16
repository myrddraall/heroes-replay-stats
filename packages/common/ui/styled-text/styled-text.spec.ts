import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StyledText, type StyledTextKind } from './styled-text';

@Component({
  imports: [StyledText],
  template: `<span [hrsStyledText]="kind()">10</span>`,
})
class Host {
  readonly kind = signal<StyledTextKind>('glow');
}

describe('StyledText', () => {
  it("sets the treatment's classes, following the kind", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.className).toBe('hrs-styled hrs-styled--glow');
    fixture.componentInstance.kind.set('bright');
    await fixture.whenStable();
    expect(span.className).toBe('hrs-styled hrs-styled--bright');
  });
});
