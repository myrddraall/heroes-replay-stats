/**
 * A picture to show: a file (`src` alone), or one picture in a sheet of many (`src` is the sheet,
 * `rect` its place in it as `[x, y, width, height]`). The shape hero-data's `Picture` has.
 */
export interface SpritePicture {
  readonly src: string;
  readonly rect?: readonly [number, number, number, number];
  /**
   * Smaller copies of the same picture, each in a sheet, smallest first (hero-data's: a heroes-assets
   * target portrait's small copy): shown at a size one covers, that one loads instead.
   */
  readonly variants?: readonly SpritePicture[];
}
