/**
 * The `local` configuration (added by tools/ng.mts where DEV_LOCAL is true: the devcontainer): the
 * maps rendered on this machine, served by `pnpm run serve.maps` and reached through the dev
 * server's proxy (proxy.local.json), so only the app's own port is needed from outside.
 */
export const environment = {
  mapPacksUrl: '/maps-local/',
} as const;
