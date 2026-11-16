/** Two pictures (RGBA, same size) compared, and their difference drawn. */
export interface Difference {
  /** The largest difference of any channel, in levels (0-255). */
  readonly largest: number;
  /** The mean difference over every colour channel, in levels. */
  readonly mean: number;
  /** The share of pixels whose largest channel difference is over 2 levels, and over 8. */
  readonly over2: number;
  readonly over8: number;
  /** The difference as a picture, 8 times as strong. */
  readonly image: ImageData;
}

export function compare(a: Uint8Array, b: Uint8Array, width: number, height: number): Difference {
  const image = new ImageData(width, height);
  let largest = 0;
  let sum = 0;
  let over2 = 0;
  let over8 = 0;
  const pixels = width * height;
  for (let p = 0; p < pixels; p++) {
    let most = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[p * 4 + c]! - b[p * 4 + c]!);
      sum += d;
      most = Math.max(most, d);
      image.data[p * 4 + c] = Math.min(255, d * 8);
    }
    image.data[p * 4 + 3] = 255;
    largest = Math.max(largest, most);
    if (most > 2) over2++;
    if (most > 8) over8++;
  }
  return {
    largest,
    mean: sum / (pixels * 3),
    over2: over2 / pixels,
    over8: over8 / pixels,
    image,
  };
}
