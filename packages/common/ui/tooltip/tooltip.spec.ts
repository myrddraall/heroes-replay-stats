import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './tooltip';

@Component({
  imports: [Tooltip],
  template: `<button type="button" [hrsTooltip]="tip" hrsTooltipShowDelay="0">Talent</button>
    <ng-template #tip><b>Hungering Arrow</b> Level 1</ng-template>`,
})
class Host {}

const tick = () => new Promise((done) => setTimeout(done));

describe('hrsTooltip', () => {
  it('shows its template in the game tooltip on focus, describing its element, and hides on blur', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.dispatchEvent(new FocusEvent('focusin'));
    await tick();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('hrs-tooltip-panel')!;
    expect(panel.textContent!.trim()).toBe('Hungering Arrow Level 1');
    expect(panel.classList).toContain('hrs-tooltip');
    expect(panel.getAttribute('role')).toBe('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(panel.id);
    button.dispatchEvent(new FocusEvent('focusout'));
    await fixture.whenStable();
    expect(document.querySelector('hrs-tooltip-panel')).toBeNull();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });
});
