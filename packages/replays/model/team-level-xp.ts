/**
 * The XP a team needs for each level after the first, from the game's data: the
 * `MinVeterancyXP` of each `VeterancyLevelArray` entry in `CBehaviorVeterancy` `HeroXPCurve`
 * (`heroesdata.stormmod/base.stormdata/GameData/BehaviorData.xml`), levels 2 to 30.
 */
const LEVEL_STEPS: readonly number[] = [
  2010, 2154, 2154, 2154, 2154, 3303, 3303, 3303, 3303, 3303, 4452, 4452, 4452, 4452, 4452, 5600,
  5600, 5600, 5600, 9000, 10000, 11500, 13000, 15000, 17000, 19500, 22000, 25000, 28000,
];

/** A team level and the XP a team has when it reaches it. */
export interface TeamLevelXp {
  readonly level: number;
  readonly xp: number;
}

/** Each team level from 2, with the XP so far that reaches it. */
export const TEAM_LEVEL_XP: readonly TeamLevelXp[] = LEVEL_STEPS.reduce<TeamLevelXp[]>(
  (levels, step, i) => [...levels, { level: i + 2, xp: (levels.at(-1)?.xp ?? 0) + step }],
  [],
);

/** The team level `xp` XP so far reaches. */
export function teamLevelAt(xp: number): number {
  return 1 + TEAM_LEVEL_XP.filter((l) => l.xp <= xp).length;
}
