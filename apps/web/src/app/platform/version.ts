import pkg from '../../../package.json';

/** The app's version — `0.0.0-MAIN` in development; the release pipeline writes the real one. */
export const APP_VERSION: string = (pkg as { version: string }).version;
