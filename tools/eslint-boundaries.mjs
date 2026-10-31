// @ts-check
/**
 * A package's import boundaries, for its ESLint config: no relative import out of its `src`
 * folder (another package is imported by its name), and of the workspace's own packages only
 * those in `allowed` (and their entry points). One config per folder depth, as how far out `../` reaches depends on it.
 *
 * With `layers` (bottom first, each a list of the package's top-level folders), a folder may
 * import only from its own layer and those below it.
 *
 * @param {{ allowed?: readonly string[], layers?: readonly (readonly string[])[] }} [options]
 */
export function packageBoundaries({ allowed = [], layers = [] } = {}) {
  const leaving = (/** @type {number} */ depth) => ({
    regex: `^(\\.\\./){${depth + 1},}`,
    message: 'This leaves the package: import another package by its name.',
  });
  const packages = {
    group: ['@myrddraall/heroes-replay-stats*', ...allowed.flatMap((p) => [`!${p}`, `!${p}/*`])],
    message: `This package may use only ${allowed.join(', ') || 'none of the workspace packages'}.`,
  };
  const rule = (/** @type {object[]} */ patterns) => ({
    'no-restricted-imports': ['error', { patterns }],
  });
  return Array.from({ length: 8 }, (_, depth) => [
    { files: [`src/${'*/'.repeat(depth)}*.ts`], rules: rule([leaving(depth), packages]) },
    // A folder's files, `depth` below `src` (1: in the folder itself): `../` that many times reaches `src`.
    ...(depth > 0
      ? layers.flatMap((layer, at) => {
          const above = layers.slice(at + 1).flat();
          if (!above.length) return [];
          return [
            {
              files: layer.map((folder) => `src/${folder}/${'*/'.repeat(depth - 1)}*.ts`),
              rules: rule([
                leaving(depth),
                packages,
                {
                  regex: `^(\\.\\./){${depth}}(${above.join('|')})(/|$)`,
                  message: `A layer imports only from its own and those below it: ${above.join(', ')} are above this one.`,
                },
              ]),
            },
          ];
        })
      : []),
  ]).flat();
}
