import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatPresets } from './stat-presets';

@Component({
  imports: [StatPresets],
  template: `<ui-stat-presets
    [builtIn]="['Default', 'Per minute']"
    [saved]="[]"
    [current]="current()"
    base="Per minute"
    (resetRequested)="resets.set(resets() + 1)"
  />`,
})
class Host {
  readonly current = signal<string | null>('Per minute');
  readonly resets = signal(0);
}

describe('StatPresets', () => {
  it('offers a reset to the preset the columns came from, only once they are changed', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const reset = () => el.querySelector<HTMLButtonElement>('button[aria-label^="Reset"]');
    expect(reset()).toBeNull();
    fixture.componentInstance.current.set(null);
    await fixture.whenStable();
    expect(reset()!.getAttribute('aria-label')).toBe('Reset the columns to Per minute');
    reset()!.click();
    expect(fixture.componentInstance.resets()).toBe(1);
  });
});
