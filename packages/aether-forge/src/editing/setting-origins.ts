/** Which level sets each of a thing's settings, as the panels mark them. */

/** Where each of a thing's settings comes from: the name of the level that sets it, where one does. */
export type SettingOrigins<K extends string> = Partial<Record<K, string>>;

/**
 * Which level sets each setting, from levels in order (the later over the earlier, as they
 * merge): its name, for the last level that sets it.
 */
export function originsOf<K extends string>(
  levels: readonly (readonly [string, Partial<Record<K, unknown>> | undefined])[],
): SettingOrigins<K> {
  const out: Partial<Record<K, string>> = {};
  for (const [name, values] of levels)
    if (values)
      for (const [key, value] of Object.entries(values) as [K, unknown][])
        if (value !== undefined) out[key] = name;
  return out;
}
