// @ts-check
/**
 * A package's import boundaries, for its ESLint config: no relative import out of its `src`
 * folder (another package is imported by its name), and of the workspace's own packages only
 * those in `allowed` (and their entry points). One config per folder depth, as how far out `../` reaches depends on it.
 *
 * @param {{ allowed?: readonly string[] }} [options]
 */
export function packageBoundaries({ allowed = [] } = {}) {
  return Array.from({ length: 8 }, (_, i) => ({
    files: [`src/${'*/'.repeat(i)}*.ts`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^(\\.\\./){${i + 1},}`,
              message: 'This leaves the package: import another package by its name.',
            },
            {
              group: [
                '@myrddraall/heroes-replay-stats*',
                ...allowed.flatMap((p) => [`!${p}`, `!${p}/*`]),
              ],
              message: `This package may use only ${allowed.join(', ') || 'none of the workspace packages'}.`,
            },
          ],
        },
      ],
    },
  }));
}
