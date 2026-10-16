import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { GLASS_ALPHA_FLOOR, ThemePreviewPage } from './theme-preview-page';

describe('ThemePreviewPage', () => {
  async function render() {
    // The background's scene isn't served here: it stays black, as it does when it can't load.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('not in this test'));
    const fixture = TestBed.createComponent(ThemePreviewPage);
    await fixture.whenStable();
    return fixture;
  }

  it('shows a panel in each variant, and the variants mixed in a neutral panel', async () => {
    const el: HTMLElement = (await render()).nativeElement;
    const panels = [...el.querySelectorAll('.variants .hrs-glass')];
    expect(panels.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Neutral',
      'Nexus neutral',
      'Blue team',
      'Red team',
    ]);
    expect(panels[1]!.classList).toContain('hrs-glass-nexus');
    expect(panels[2]!.classList).toContain('hrs-glass-blue');
    expect(panels[3]!.classList).toContain('hrs-glass-red');
    const tables = [...el.querySelectorAll('.match table')];
    expect(tables.map((t) => t.className)).toEqual(['hrs-glass-blue', 'hrs-glass-red']);
  });

  it("sets the glass's opacity and blur from its controls", async () => {
    const fixture = await render();
    const main: HTMLElement = fixture.nativeElement.querySelector('main');
    expect(main.style.getPropertyValue('--hrs-glass-alpha')).toBe('0.5');
    expect(main.style.getPropertyValue('--hrs-glass-backdrop')).toBe('none');

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('input[matSliderThumb]');
    expect(Number(slider.min)).toBe(GLASS_ALPHA_FLOOR);
    slider.value = '0.5';
    slider.dispatchEvent(new Event('input'));
    slider.dispatchEvent(new Event('change'));
    (fixture.nativeElement.querySelector('mat-slide-toggle button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(main.style.getPropertyValue('--hrs-glass-alpha')).toBe('0.5');
    expect(main.style.getPropertyValue('--hrs-glass-backdrop')).toBe('blur(6px)');
  });
});
