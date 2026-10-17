import { describe, expect, it } from 'vitest';
import { resolveYou } from './resolve-you';

const players = [
  { slot: 0, toonHandle: '1-Hero-1-10', team: 0 as const },
  { slot: 1, toonHandle: '1-Hero-1-11', team: 0 as const },
  { slot: 5, toonHandle: '1-Hero-1-15', team: 1 as const },
  { slot: 6, toonHandle: null, team: 1 as const }, // AI
];
const recordedBy = (h: string | null) => ({ players, recorderToonHandle: h });

describe('resolveYou', () => {
  it('is the recorder when nothing is marked as me', () => {
    expect(resolveYou(recordedBy('1-Hero-1-15'), new Set())).toEqual({ slots: [5], team: 1 });
  });

  it('prefers the recorder when it is one of several of yours in the game', () => {
    const me = new Set(['1-Hero-1-10', '1-Hero-1-15']);
    expect(resolveYou(recordedBy('1-Hero-1-15'), me)).toEqual({ slots: [5], team: 1 });
  });

  it("is your account in someone else's recording", () => {
    const me = new Set(['1-Hero-1-11']);
    expect(resolveYou(recordedBy('1-Hero-1-15'), me)).toEqual({ slots: [1], team: 0 });
  });

  it('is all of yours when the recorder is not, with a team only if they share one', () => {
    expect(resolveYou(recordedBy(null), new Set(['1-Hero-1-10', '1-Hero-1-11']))).toEqual({
      slots: [0, 1],
      team: 0,
    });
    expect(resolveYou(recordedBy(null), new Set(['1-Hero-1-10', '1-Hero-1-15']))).toEqual({
      slots: [0, 5],
      team: null,
    });
  });

  it('falls back to the recorder when none of yours played, and to nobody without one', () => {
    expect(resolveYou(recordedBy('1-Hero-1-10'), new Set(['2-Hero-1-99']))).toEqual({
      slots: [0],
      team: 0,
    });
    expect(resolveYou(recordedBy(null), new Set())).toEqual({ slots: [], team: null });
  });
});
