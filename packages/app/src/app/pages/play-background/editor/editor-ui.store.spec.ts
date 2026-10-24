import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { DOUBLE_CLICK, EditorUiStore } from './editor-ui.store';

describe('the editor’s clicks in the lists', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorUiStore, provideRouter([])] });
  });

  it('takes a second click on the same thing soon after as a double-click', () => {
    const ui = TestBed.inject(EditorUiStore);
    expect(ui.clickedAgain('planet:korhal', 1000)).toBe(false);
    expect(ui.clickedAgain('planet:korhal', 1000 + DOUBLE_CLICK / 2)).toBe(true);
    // A third makes a new first click, not another double-click.
    expect(ui.clickedAgain('planet:korhal', 1000 + DOUBLE_CLICK)).toBe(false);
  });

  it('takes clicks on other things, or slow ones, as single clicks', () => {
    const ui = TestBed.inject(EditorUiStore);
    ui.clickedAgain('planet:korhal', 0);
    expect(ui.clickedAgain('planet:azeroth', 100)).toBe(false);
    expect(ui.clickedAgain('planet:azeroth', 100 + DOUBLE_CLICK + 1)).toBe(false);
  });
});

describe('the editor’s view of an anchored sky', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [EditorUiStore, provideRouter([])] });
  });

  it('has the sky follow the camera looked through until switched off, and keeps the choice', () => {
    const ui = TestBed.inject(EditorUiStore);
    expect(ui.skyFollows()).toBe(true);
    ui.setSkyFollows(false);
    expect(ui.skyFollows()).toBe(false);
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('hrs.background-editor') ?? '{}')).toMatchObject({
      skyFollows: false,
    });
  });
});
