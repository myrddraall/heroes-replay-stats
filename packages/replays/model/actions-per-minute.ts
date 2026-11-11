/** How many commands a player gave in one minute of the game's clock. */
export interface ActionsPerMinute {
  readonly slot: number;
  /** From the gates opening: 0 is the first minute. */
  readonly minute: number;
  readonly actions: number;
}
