/**
 * A talent build as the game links it in chat, and takes it pasted back (`[T1231231,Lucio]`): `T`,
 * the talent chosen at each tier as its place in the tier (1 first; 0 for a tier not chosen), then
 * the hero's id in the game's data (`DemonHunter` for Valla, `Wizard` for Li-Ming).
 */
export function talentBuildLink(heroId: string, choices: readonly (number | null)[]): string {
  return `[T${choices.map((choice) => choice ?? 0).join('')},${heroId}]`;
}
