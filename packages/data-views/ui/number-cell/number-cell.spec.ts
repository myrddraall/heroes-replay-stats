import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { NumberCell, type NumberMark } from './number-cell';

async function render(inputs: {
  value: string;
  styled?: boolean;
  shortValue?: string | null;
  short?: boolean;
  mark?: NumberMark | null;
  groupBestLabel?: string;
}) {
  const fixture = TestBed.createComponent(NumberCell);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  return {
    text: el.textContent!.replace(/\s+/g, ' ').trim(),
    classes: [...el.classList].filter((c) => c.startsWith('number-cell')),
  };
}

describe('NumberCell', () => {
  it('shows the figure, or its short form when pressed for room', async () => {
    expect(await render({ value: '39,609', shortValue: '39.6k' })).toEqual({ text: '39,609', classes: [] });
    expect((await render({ value: '39,609', shortValue: '39.6k', short: true })).text).toBe('39.6k');
    // no short form: the figure as it is
    expect((await render({ value: '7', short: true })).text).toBe('7');
  });

  it("draws in the game's display type when styled: the best of its group glowing", async () => {
    expect((await render({ value: '7', styled: true })).classes).toEqual([]);
    const plain = TestBed.createComponent(NumberCell);
    plain.componentRef.setInput('value', '7');
    plain.componentRef.setInput('styled', true);
    await plain.whenStable();
    expect([...(plain.nativeElement as HTMLElement).classList]).toEqual(['hrs-styled', 'hrs-styled--base']);
    const best = TestBed.createComponent(NumberCell);
    best.componentRef.setInput('value', '7');
    best.componentRef.setInput('styled', true);
    best.componentRef.setInput('mark', 'group-best');
    await best.whenStable();
    expect([...(best.nativeElement as HTMLElement).classList]).toEqual(['hrs-styled', 'hrs-styled--glow']);
    expect((best.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '7 (best in its group)',
    );
  });

  it('brightens the best of its column when styled', async () => {
    const fixture = TestBed.createComponent(NumberCell);
    fixture.componentRef.setInput('value', '7');
    fixture.componentRef.setInput('styled', true);
    fixture.componentRef.setInput('mark', 'best');
    await fixture.whenStable();
    expect([...(fixture.nativeElement as HTMLElement).classList]).toEqual(['hrs-styled', 'hrs-styled--bright']);
  });

  it('marks the best of its column and of its group, for screen readers too', async () => {
    expect(await render({ value: '7', mark: 'best' })).toEqual({
      text: '7 (best)',
      classes: ['number-cell--best'],
    });
    expect(await render({ value: '6', mark: 'group-best', groupBestLabel: 'best on the team' })).toEqual({
      text: '6 (best on the team)',
      classes: ['number-cell--group-best'],
    });
  });
});
