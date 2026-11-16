import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Sprite } from '@myrddraall/heroes-replay-stats-sheets/ui';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GameText } from './game-text';

describe('GameText', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  async function setUp(text: string) {
    const fixture = TestBed.createComponent(GameText);
    fixture.componentRef.setInput('text', text);
    await fixture.whenStable();
    return fixture;
  }
  const render = async (text: string) => (await setUp(text)).nativeElement as HTMLElement;

  it('draws its runs in the colours the markup gives, and its line breaks', async () => {
    const el = await render('Heal for <c val="bfd4fd" hlt-name="#TooltipNumbers">30%</c>.<n/>Again');
    expect(el.textContent).toBe('Heal for 30%.Again');
    const run = el.querySelector<HTMLElement>('.run')!;
    expect(run.textContent!.trim()).toBe('30%');
    expect(run.style.color).toBe('rgb(191, 212, 253)');
    expect(el.querySelectorAll('br').length).toBe(1);
  });

  it("gives a value's per-level scaling in words", async () => {
    const el = await render('take <c val="bfd4fd">90~~0.04~~</c> damage');
    expect(el.textContent).toBe('take 90 (+4% per level) damage');
  });

  it("draws a gradient run's two ends, and the inline icons it knows at their size", async () => {
    const fixture = await setUp(
      '<img path="@UI/StormTalentInTextQuestIcon" width="20" height="22"/><c val="ef6e28-ad231e">Destroyer</c><img path="@UI/Unknown"/>',
    );
    const el: HTMLElement = fixture.nativeElement;
    const gradient = el.querySelector<HTMLElement>('.run--gradient')!;
    expect([gradient.style.getPropertyValue('--from'), gradient.style.getPropertyValue('--to')]).toEqual([
      '#ef6e28',
      '#ad231e',
    ]);
    const icons = el.querySelectorAll<HTMLElement>('.icon');
    expect(icons.length).toBe(1);
    const sprites = fixture.debugElement.queryAll(By.directive(Sprite));
    expect(sprites.map((s) => s.injector.get(Sprite).hrsSprite())).toEqual(['talents#quest']);
    expect(icons[0]!.style.width).toBe(`${20 / 18}em`);
  });
});
