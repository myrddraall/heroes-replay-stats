/** A name like `validation#panel`: the sheet and the entry in it. */
export function parseSheetName(name: string): { sheet: string; entry: string } {
  const at = name.indexOf('#');
  if (at <= 0 || at === name.length - 1) throw new Error(`"${name}" isn't <sheet>#<name>`);
  return { sheet: name.slice(0, at), entry: name.slice(at + 1) };
}
