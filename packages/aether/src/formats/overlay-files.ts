/** How overlays' files are named as they are loaded: the game data's styles, and those made in the editor. */

/** What the ids of overlays made in the editor start with. */
export const CREATED_OVERLAY = '@overlay-';

/** Whether an overlay is one made in the editor. */
export const createdOverlay = (id: string) => id.startsWith(CREATED_OVERLAY);

/**
 * The file an overlay is loaded from: the game data's style file, or one made in the editor (its
 * own id; `revision` tells a changed one apart, so it is built again).
 */
export const overlayFile = (id: string, revision?: string) =>
  createdOverlay(id) ? (revision ? `${id}#${revision}` : id) : `style-${id}`;

/** The overlay a loaded file is of (its file's id, as `overlayFile` makes it). */
export const overlayOfFile = (file: string) =>
  createdOverlay(file) ? file.split('#')[0]! : file.replace(/^style-/, '');
