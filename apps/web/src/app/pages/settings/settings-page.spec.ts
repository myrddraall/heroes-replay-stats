import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GraphicsStore } from '../../data/settings/graphics.store';
import { HARDWARE_ACCELERATION } from '../../data/settings/hardware-acceleration';
import { providePlatform } from '../../platform/provide-platform';
import { SettingsPage } from './settings-page';

describe('SettingsPage graphics', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [providePlatform(), { provide: HARDWARE_ACCELERATION, useValue: true }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    return fixture;
  }

  const buttons = (el: HTMLElement, label: string) => [
    ...el.querySelectorAll<HTMLButtonElement>(`[aria-labelledby="${label}"] button`),
  ];

  it('sets a quality preset, and shows when it is custom', async () => {
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    const graphics = TestBed.inject(GraphicsStore);
    const quality = buttons(el, 'quality-label');
    expect(quality[5]!.disabled).toBe(true); // no custom quality yet
    expect(quality.map((b) => b.textContent?.trim())).toEqual([
      'Low',
      'Medium',
      'High',
      'Ultra',
      'Extreme',
      'Custom',
    ]);
    expect(quality[2]!.getAttribute('aria-checked')).toBe('true');

    quality[0]!.click();
    await fixture.whenStable();
    expect(graphics.quality()).toBe('low');
    expect(graphics.animate()).toBe(false);

    graphics.set({ idleFps: 20 });
    await fixture.whenStable();
    expect(buttons(el, 'quality-label')[5]!.getAttribute('aria-checked')).toBe('true');

    buttons(el, 'quality-label')[1]!.click(); // Medium
    await fixture.whenStable();
    expect(graphics.quality()).toBe('medium');
    buttons(el, 'quality-label')[5]!.click(); // the custom one again
    await fixture.whenStable();
    expect(graphics.quality()).toBe('custom');
    expect(graphics.idleFps()).toBe(20);
  });

  it('offers the colour only when it is fixed', async () => {
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-select')).not.toBeNull();
    buttons(el, 'colour-mode-label')[1]!.click(); // Random
    await fixture.whenStable();
    expect(TestBed.inject(GraphicsStore).colourMode()).toBe('random');
    expect(el.querySelector('mat-select')).toBeNull();
  });
});
