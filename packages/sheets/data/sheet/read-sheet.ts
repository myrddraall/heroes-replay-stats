import type { SheetMeta } from '../../model';

/** The chunk heroes-assets keeps a sheet's metadata in: deflate-raw JSON, right after the header. */
const META_CHUNK = 'HRSM';

const fourCc = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);

/**
 * A sheet's picture and metadata from its file's bytes: the WebP as it is (a browser skips the
 * metadata chunk) and the metadata unpacked. Fails for a file that isn't a WebP, has no metadata
 * or has a version this app doesn't read.
 */
export async function readSheet(bytes: ArrayBuffer): Promise<{ meta: SheetMeta; image: Blob }> {
  const data = new Uint8Array(bytes);
  const view = new DataView(bytes);
  if (fourCc(data, 0) !== 'RIFF' || fourCc(data, 8) !== 'WEBP') throw new Error('not a WebP file');
  for (let at = 12; at + 8 <= data.length; ) {
    const size = view.getUint32(at + 4, true);
    if (fourCc(data, at) === META_CHUNK) {
      const packed = new Response(data.slice(at + 8, at + 8 + size)).body!;
      const text = await new Response(
        packed.pipeThrough(new DecompressionStream('deflate-raw')),
      ).text();
      const meta = JSON.parse(text) as SheetMeta;
      if (meta.v !== 1) throw new Error(`a sheet's metadata version ${String(meta.v)}, not 1`);
      return { meta, image: new Blob([bytes], { type: 'image/webp' }) };
    }
    at += 8 + size + (size & 1);
  }
  throw new Error('the sheet has no metadata');
}
