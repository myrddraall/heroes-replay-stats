import type { StatColumn } from '../../model';

const perMinute = 'per minute of the game';
const per10Minutes = 'per 10 minutes of the game';
const ccSummed =
  'Summed over every enemy hero affected, so it can be more than 60 seconds a minute.';

/** A points-per-minute column. */
function pointsPerMinute(id: string, label: string, of: string): StatColumn {
  return {
    id,
    label: `${label} / min`,
    format: 'decimal',
    digits: [0, 0],
    description: `${of} ${perMinute}.`,
  };
}

/** A counts-per-10-minutes column. */
function per10(id: string, label: string, of: string): StatColumn {
  return {
    id,
    label: `${label} / 10 min`,
    format: 'decimal',
    digits: [1, 1],
    description: `${of} ${per10Minutes}.`,
  };
}

/** A seconds-of-CC-per-minute column. */
function ccPerMinute(id: string, label: string, of: string): StatColumn {
  return {
    id,
    label: `${label} s / min`,
    format: 'decimal',
    digits: [1, 1],
    description: `Seconds of ${of} on enemy heroes ${perMinute}. ${ccSummed}`,
  };
}

/** The `playerStats` analyser's rates: per minute, per 10 minutes and the damage ratio. */
const RATE_COLUMNS: readonly StatColumn[] = [
  pointsPerMinute('HeroDamagePerMinute', 'Hero Damage', 'Hero damage'),
  pointsPerMinute('TeamfightHeroDamagePerMinute', 'Teamfight Hero Damage', 'Teamfight hero damage'),
  pointsPerMinute('SiegeDamagePerMinute', 'Siege Damage', 'Siege damage'),
  pointsPerMinute('StructureDamagePerMinute', 'Structure Damage', 'Structure damage'),
  pointsPerMinute('MinionDamagePerMinute', 'Minion Damage', 'Minion damage'),
  pointsPerMinute('HealingPerMinute', 'Healing', 'Healing'),
  pointsPerMinute('SelfHealingPerMinute', 'Self Healing', 'Self healing'),
  pointsPerMinute('ShieldingPerMinute', 'Protection', 'Protection given to allies'),
  pointsPerMinute('DamageTakenPerMinute', 'Damage Taken', 'Damage taken'),
  pointsPerMinute('DamageSoakedPerMinute', 'Hero Damage Taken', 'Hero damage taken'),
  pointsPerMinute('XPPerMinute', 'XP', 'XP contributed'),
  per10('TakedownsPer10Minutes', 'Takedowns', 'Takedowns'),
  per10('KillsPer10Minutes', 'Kills', 'Killing blows on enemy heroes'),
  per10('DeathsPer10Minutes', 'Deaths', 'Deaths'),
  per10('MercCampCapturesPer10Minutes', 'Merc Camps Taken', 'Mercenary camps taken'),
  {
    id: 'DamageRatio',
    label: 'Damage Ratio',
    format: 'decimal',
    digits: [2, 2],
    description: 'Hero damage dealt for each point of damage taken.',
  },
  ccPerMinute('CCSecondsPerMinute', 'CC', 'crowd control (stuns, roots, silences and slows)'),
  ccPerMinute('HardCCSecondsPerMinute', 'Hard CC', 'stuns, roots and silences'),
  ccPerMinute('SoftCCSecondsPerMinute', 'Soft CC', 'slows'),
];

/** The `activity` analyser's columns: how the player played and talked, from its own table. */
const ACTIVITY_COLUMNS: readonly StatColumn[] = [
  {
    id: 'apm',
    label: 'APM',
    format: 'decimal',
    digits: [0, 0],
    description: 'Orders given per minute of the game.',
  },
  {
    id: 'castsPerMinute',
    label: 'Casts / min',
    format: 'decimal',
    digits: [0, 0],
    description:
      'Orders with an ability, such as attacks and hero abilities, per minute of the game.',
  },
  { id: 'pings', label: 'Pings', format: 'integer' },
  {
    id: 'minimapPings',
    label: 'Minimap Pings',
    format: 'integer',
    description: 'Pings made on the minimap.',
  },
  {
    id: 'chatMessages',
    label: 'Chat Messages',
    format: 'integer',
    description: 'Lines typed in the chat.',
  },
  { id: 'sprays', label: 'Sprays', format: 'integer' },
  { id: 'voiceLines', label: 'Voice Lines', format: 'integer' },
  {
    id: 'upvotesGiven',
    label: 'Votes Given',
    format: 'integer',
    description: 'Votes the player gave other players at the end of the game.',
  },
];

/** The columns read from the `activity` table rather than from the player stats. */
export const ACTIVITY_COLUMN_IDS: ReadonlySet<string> = new Set(ACTIVITY_COLUMNS.map((c) => c.id));

/**
 * Columns worked out from another stat, by the stat they come from: what the replay's build can
 * tell about that stat holds for them too.
 */
export const STAT_SOURCES: Readonly<Record<string, string>> = {
  HeroDamagePerMinute: 'HeroDamage',
  TeamfightHeroDamagePerMinute: 'TeamfightHeroDamage',
  SiegeDamagePerMinute: 'SiegeDamage',
  StructureDamagePerMinute: 'StructureDamage',
  MinionDamagePerMinute: 'MinionDamage',
  HealingPerMinute: 'Healing',
  SelfHealingPerMinute: 'SelfHealing',
  ShieldingPerMinute: 'ProtectionGivenToAllies',
  DamageTakenPerMinute: 'DamageTaken',
  DamageSoakedPerMinute: 'DamageSoaked',
  XPPerMinute: 'ExperienceContribution',
  TakedownsPer10Minutes: 'Takedowns',
  KillsPer10Minutes: 'SoloKill',
  DeathsPer10Minutes: 'Deaths',
  MercCampCapturesPer10Minutes: 'MercCampCaptures',
  DamageRatio: 'DamageTaken',
  CCSecondsPerMinute: 'TimeCCdEnemyHeroes',
  HardCCSecondsPerMinute: 'TimeStunningEnemyHeroes',
  SoftCCSecondsPerMinute: 'TimeSlowedEnemyHeroes',
};

/** The stats where less is better: deaths, time dead, disconnects. */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set([
  'Deaths',
  'TimeSpentDead',
  'OutnumberedDeaths',
  'DeathsToNPCs',
  'PercentGameSpentDead',
  'Disconnects',
  'Reconnects',
  'TimeDisconnected',
  'PercentOfGameDisconnected',
  'DeathsPer10Minutes',
]);

/** A performance stat, with which way is better, so a table marks its best and sorts best first. */
const ranked = (column: StatColumn): StatColumn => ({
  ...column,
  better: LOWER_IS_BETTER.has(column.id) ? 'lower' : 'higher',
});

/**
 * The player's performance stats, by the `playerStats` analyser's column ids, with the labels,
 * descriptions and formats the 2018 viewer gave them, then the rates.
 */
const PERFORMANCE_COLUMNS: readonly StatColumn[] = [
  { id: 'Takedowns', label: 'Takedowns', format: 'integer' },
  { id: 'Deaths', label: 'Deaths', format: 'integer' },
  { id: 'TownKills', label: 'Town Kills', format: 'integer' },
  { id: 'MinionsKilled', label: 'Minion Kills', format: 'integer' },
  { id: 'Kills', label: 'Kills', format: 'integer' },
  {
    id: 'SoloKill',
    label: 'Solo Kills',
    format: 'integer',
    description: 'Number of Player kills without the assistance of team mates',
  },
  { id: 'Assists', label: 'Assists', format: 'integer' },
  {
    id: 'Multikill',
    label: 'Multikills',
    format: 'integer',
    description: "The team's multi-kills the player took part in.",
  },
  {
    id: 'TeamTakedowns',
    label: 'Team Takedowns',
    format: 'integer',
    description: "The team's takedowns, the same for every player on the team.",
  },
  { id: 'MetaExperience', label: 'Total Team XP', format: 'integer' },
  { id: 'ExperienceContribution', label: 'XP', format: 'integer' },
  { id: 'Healing', label: 'Healing', format: 'integer' },
  { id: 'SiegeDamage', label: 'Siege Damage', format: 'integer' },
  { id: 'StructureDamage', label: 'Structure Damage', format: 'integer' },
  { id: 'MinionDamage', label: 'Minion Damage', format: 'integer' },
  { id: 'HeroDamage', label: 'Hero Damage', format: 'integer' },
  {
    id: 'PhysicalDamage',
    label: 'Physical Damage (all targets)',
    format: 'integer',
    description:
      'Physical damage the player dealt to all targets: heroes, minions, mercenaries and structures.',
  },
  {
    id: 'SpellDamage',
    label: 'Spell Damage (all targets)',
    format: 'integer',
    description:
      'Spell damage the player dealt to all targets: heroes, minions, mercenaries and structures.',
  },
  { id: 'MercCampCaptures', label: 'Merc Camps Taken', format: 'integer' },
  { id: 'WatchTowerCaptures', label: 'Watch Towers Taken', format: 'integer' },
  { id: 'SelfHealing', label: 'Self Healing', format: 'integer' },
  { id: 'TimeSpentDead', label: 'Time Dead', format: 'duration' },
  {
    id: 'TimeCCdEnemyHeroes',
    label: 'Total CC',
    format: 'duration',
    description: "Time that enemy players where under the effect of the player' crowd control.",
  },
  { id: 'CreepDamage', label: 'Merc Damage', format: 'integer' },
  { id: 'SummonDamage', label: 'Summon Damage', format: 'integer' },
  { id: 'DamageTaken', label: 'Damage Taken', format: 'integer' },
  { id: 'DamageSoaked', label: 'Hero Damage Taken', format: 'integer' },
  { id: 'KilledTreasureGoblin', label: 'Treasure Goblin Kills', format: 'integer' },
  { id: 'HighestKillStreak', label: 'Highest Kill Streak', format: 'integer' },
  { id: 'ProtectionGivenToAllies', label: 'Protection', format: 'integer' },
  {
    id: 'TimeSilencingEnemyHeroes',
    label: 'Silence',
    format: 'duration',
    description:
      'Time that enemy players where silenced by the player. Silence includes "Silence" and "Polymorph" effects',
  },
  {
    id: 'TimeRootingEnemyHeroes',
    label: 'Roots',
    format: 'duration',
    description: 'Time that enemy players where rooted by the player.',
  },
  {
    id: 'TimeStunningEnemyHeroes',
    label: 'Stuns',
    format: 'duration',
    description:
      'Time that enemy players where stunned by the player. Stun includes "Stun", "Time Stop", "Stasis" and "Knockback" effects',
  },
  {
    id: 'TimeSlowedEnemyHeroes',
    label: 'Slows',
    format: 'duration',
    description: 'Time that enemy players where slowed by the player.',
  },
  { id: 'ClutchHealsPerformed', label: 'Clutch Heals', format: 'integer' },
  { id: 'EscapesPerformed', label: 'Escapes', format: 'integer' },
  { id: 'VengeancesPerformed', label: 'Vengeances', format: 'integer' },
  { id: 'TeamfightEscapesPerformed', label: 'Teamfight Escapes', format: 'integer' },
  { id: 'OutnumberedDeaths', label: 'Outnumbered Deaths', format: 'integer' },
  {
    id: 'DeathsToNPCs',
    label: 'Deaths to NPCs',
    format: 'integer',
    description:
      'Number oof times the player died to NPCs without the involvment of an enemey player. PAY ATTENTION!',
  },
  { id: 'TeamfightHealingDone', label: 'Teamfight Healing', format: 'integer' },
  { id: 'TeamfightDamageTaken', label: 'Teamfight Damage Taken', format: 'integer' },
  { id: 'TeamfightHeroDamage', label: 'Teamfight Hero Damage', format: 'integer' },
  {
    id: 'AltarDamageDone',
    label: 'Altar Damage',
    format: 'integer',
  },
  { id: 'OnFireTimeOnFire', label: 'Time On Fire', format: 'duration' },
  {
    id: 'LunarNewYearSuccesfulArtifactTurnIns',
    label: 'LunarNewYearSuccesfulArtifactTurnIns',
    format: 'integer',
  },
  { id: 'TimeOnPoint', label: 'TimeOnPoint', format: 'duration' },
  { id: 'LunarNewYearEventCompleted', label: 'LunarNewYearEventCompleted', format: 'integer' },
  { id: 'StarcraftDailyEventCompleted', label: 'StarcraftDailyEventCompleted', format: 'integer' },
  { id: 'StarcraftPiecesCollected', label: 'StarcraftPiecesCollected', format: 'integer' },
  {
    id: 'LunarNewYearRoosterEventCompleted',
    label: 'LunarNewYearRoosterEventCompleted',
    format: 'integer',
  },
  { id: 'TouchByBlightPlague', label: 'TouchByBlightPlague', format: 'integer' },
  { id: 'PachimariMania', label: 'PachimariMania', format: 'integer' },
  { id: 'DamageDoneToImmortal', label: 'DamageDoneToImmortal', format: 'integer' },
  { id: 'KillParticipation', label: 'Kill Participation', format: 'percent', digits: [0, 0] },
  { id: 'KDARatio', label: 'KDA', format: 'decimal' },
  { id: 'KDRatio', label: 'Kills to Deaths', format: 'decimal' },
  { id: 'ADRatio', label: 'Assists to Deaths', format: 'decimal' },
  { id: 'AverageHeroDamagePerLife', label: 'Hero Damage / Life', format: 'integer' },
  {
    id: 'AverageTeamfightHeroDamagePerLife',
    label: 'Teamfight Hero Damage / Life',
    format: 'integer',
  },
  { id: 'AverageSiegeDamagePerLife', label: 'Siege Damage / Life', format: 'integer' },
  { id: 'AverageHealingPerLife', label: 'Healing / Life', format: 'integer' },
  { id: 'AverageTeamfightHealingPerLife', label: 'Teamfight Healing / Life', format: 'integer' },
  { id: 'AverageDamageTakenPerLife', label: 'Damage Taken / Life', format: 'integer' },
  { id: 'AverageDamageSoakedPerLife', label: 'Hero Damage Taken / Life', format: 'integer' },
  {
    id: 'AverageTeamfightDamageTakenPerLife',
    label: 'Teamfight Damage Taken / Life',
    format: 'integer',
  },
  { id: 'PercentHeroDamage', label: 'Hero Damage %', format: 'percent' },
  { id: 'PercentTeamfightHeroDamage', label: 'Teamfight Hero Damage %', format: 'percent' },
  { id: 'PercentSiegeDamage', label: 'Siege Damage %', format: 'percent' },
  { id: 'PercentStructureDamage', label: 'Structure Damage %', format: 'percent' },
  { id: 'PercentMinionDamage', label: 'Minion Damage %', format: 'percent' },
  { id: 'PercentCreepDamage', label: 'Merc Damage %', format: 'percent' },
  { id: 'PercentHealing', label: 'Healing %', format: 'percent' },
  { id: 'PercentProtection', label: 'Protection %', format: 'percent' },
  { id: 'PercentTeamfightHealing', label: 'Teamfight Healing %', format: 'percent' },
  { id: 'PercentDamageTaken', label: 'Damage Taken %', format: 'percent' },
  { id: 'PercentDamageSoaked', label: 'Hero Damage Taken %', format: 'percent' },
  { id: 'PercentTeamfightDamageTaken', label: 'Teamfight Damage Taken %', format: 'percent' },
  { id: 'PercentXPContribution', label: 'XP %', format: 'percent' },
  { id: 'PercentGameSpentDead', label: 'Time Dead %', format: 'percent' },
  { id: 'PercentTimeOnFire', label: 'Time On Fire %', format: 'percent' },
  { id: 'PercentDamageHealed', label: 'Damage Healed %', format: 'percent' },
  { id: 'Disconnects', label: 'Disconnects', format: 'integer' },
  { id: 'Reconnects', label: 'Reconnects', format: 'integer' },
  { id: 'TimeDisconnected', label: 'Time Disconnected', format: 'duration' },
  { id: 'PercentOfGameDisconnected', label: 'Time Disconnected %', format: 'percent' },
  { id: 'VotesReceived', label: 'Votes Received', format: 'integer' },
  {
    id: 'MercsKilledCamp',
    label: 'Merc Kills Jungle',
    format: 'integer',
    description:
      "Number of mercs killed at camps. Only killing blows are counted, it does not mean other players didn't help ",
  },
  {
    id: 'MercsKilledLane',
    label: 'Merc Kills Lane',
    format: 'integer',
    description:
      "Number of mercs killed in lane. Only killing blows are counted, it does not mean other players didn't help ",
  },
  {
    id: 'BossKilledCamp',
    label: 'Boss Kills Jungle',
    format: 'integer',
    description:
      "Number of bosses killed at camps. Only killing blows are counted, it does not mean other players didn't help ",
  },
  {
    id: 'BossKilledLane',
    label: 'Boos Kills Lane',
    format: 'integer',
    description:
      "Number of bosses killed in lane. Only killing blows are counted, it does not mean other players didn't help ",
  },
  { id: 'RegenGlobesCollected', label: 'Regen Globes Colleced', format: 'integer' },
  ...RATE_COLUMNS,
];

/**
 * Every stat the player stats tables can show: the performance stats, each with which way is
 * better, then the `activity` analyser's columns, which have no best (how much someone pinged or
 * chatted).
 */
export const STAT_COLUMNS: readonly StatColumn[] = [
  ...PERFORMANCE_COLUMNS.map(ranked),
  ...ACTIVITY_COLUMNS,
];
