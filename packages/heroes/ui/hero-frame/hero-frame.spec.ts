import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeroFrame } from './hero-frame';

@Component({
  imports: [HeroFrame],
  template: `<hrs-hero-frame><span class="content">icon</span></hrs-hero-frame>`,
})
class Host {}

describe('HeroFrame', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it('shows its content in the ring, the ring hidden from screen readers', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const frame: HTMLElement = fixture.nativeElement.querySelector('hrs-hero-frame');
    expect(frame.querySelector('.content')!.textContent).toBe('icon');
    expect(frame.querySelector('.ring')!.getAttribute('aria-hidden')).toBe('true');
  });
});
