/** An error as a page shows it; `null` for none. */
export function errorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  return error instanceof Error ? error.message : String(error);
}
