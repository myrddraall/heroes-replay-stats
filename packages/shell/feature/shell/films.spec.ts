import { describe, expect, it } from 'vitest';
import { filmStyle } from './films';

describe('filmStyle', () => {
  it('keeps every film at its floor at 0, unblurred', () => {
    expect(filmStyle(0, false)).toEqual({
      '--hrs-surface-alpha': '0.72',
      '--hrs-surface-alpha-raised': '0.92',
      '--hrs-surface-alpha-modal': '0.9',
      '--hrs-backdrop': 'none',
      '--hrs-backdrop-raised': 'none',
      '--hrs-backdrop-modal': 'none',
    });
  });

  it('moves them all together towards solid, and blurs when asked', () => {
    const style = filmStyle(0.5, true);
    expect(style['--hrs-surface-alpha']).toBe('0.86');
    expect(style['--hrs-surface-alpha-raised']).toBe('0.96');
    expect(style['--hrs-surface-alpha-modal']).toBe('0.95');
    expect(style['--hrs-backdrop']).toBe('blur(6px)');
    expect(filmStyle(1, false)['--hrs-surface-alpha']).toBe('1');
  });
});
