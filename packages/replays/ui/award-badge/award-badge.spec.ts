import { TestBed } from '@angular/core/testing';
import { provideFakeSheets } from '@myrddraall/heroes-replay-stats-sheets/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AwardBadge } from './award-badge';

describe('AwardBadge', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideFakeSheets()] }));

  it("shows the award's badge, named for the award", async () => {
    const fixture = TestBed.createComponent(AwardBadge);
    fixture.componentRef.setInput('picture', { src: 'mainhealer_blue.png' });
    fixture.componentRef.setInput('name', 'Main Healer');
    await fixture.whenStable();
    const img = (fixture.nativeElement as HTMLElement).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('mainhealer_blue.png');
    expect(img.alt).toBe('Main Healer');
  });

  it('shows nothing without a picture', async () => {
    const fixture = TestBed.createComponent(AwardBadge);
    fixture.componentRef.setInput('name', 'Main Healer');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
  });
});
