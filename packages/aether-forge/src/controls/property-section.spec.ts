import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PropertySection } from './property-section';

@Component({
  imports: [PropertySection],
  template: `
    <forge-property-section title="Outer" id="outer">
      <forge-property-section title="Inner" id="inner" />
    </forge-property-section>
  `,
})
class Nested {}

describe('PropertySection', () => {
  it('is a pod at the top of a panel, and just its heading inside another section', async () => {
    const fixture = TestBed.createComponent(Nested);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#outer')!.classList).toContain('pod');
    expect(el.querySelector('#inner')!.classList).not.toContain('pod');
  });
});
