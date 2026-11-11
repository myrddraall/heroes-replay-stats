import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SHEET_PICTURES } from '../../model';
import { SpriteMask } from './sprite-mask';

@Component({
  imports: [SpriteMask],
  template: `<span hrsSpriteMask="profile#hero-frame"></span>`,
})
class Host {}

describe('SpriteMask', () => {
  it('hides its element until the picture has loaded, never showing its plain box', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SHEET_PICTURES,
          useValue: {
            sheetUrl: () => 'sheet.webp',
            load: () => undefined,
            status: () => undefined,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const span: HTMLElement = fixture.nativeElement.querySelector('span');
    expect(span.style.maskImage).toBe('linear-gradient(transparent, transparent)');
  });
});
