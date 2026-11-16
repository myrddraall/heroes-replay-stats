/** Whether a name has every word of a search in it (any case); an empty search keeps everyone. */
export function nameFits(name: string, search: string): boolean {
  const words = search.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const lower = name.toLocaleLowerCase();
  return words.every((w) => lower.includes(w));
}
