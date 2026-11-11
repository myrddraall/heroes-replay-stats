import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TalentFrame } from './talent-frame';

describe('TalentFrame', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  async function render(state: string, picture: { src: string } | null) {
    const fixture = TestBed.createComponent(TalentFrame);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('picture', picture);
    fixture.componentRef.setInput('name', 'Hungering Arrow');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const shown = [...el.querySelectorAll<HTMLElement>('[hrsframefront]')]
      .filter((layer) => layer.style.display !== 'none')
      .map((layer) => layer.querySelector('img')!.getAttribute('hrssprite'));
    return { el, shown };
  }

  it("shows the talent's icon, named, in its state's border", async () => {
    const { el, shown } = await render('heroic', { src: 'https://example.test/arrow.png' });
    expect(el.querySelector<HTMLImageElement>('.icon img')!.alt).toBe('Hungering Arrow');
    expect(shown).toEqual(['talents#heroic-frame']);
    expect(el.getAttribute('state')).toBe('heroic');
  });

  it('shows an empty tier without an icon, in its own border', async () => {
    const { el, shown } = await render('empty', null);
    expect(el.querySelector('.icon img')).toBeNull();
    expect(shown).toEqual(['talents#empty-frame']);
  });
});
