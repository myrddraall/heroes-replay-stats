import { describe, expect, it } from 'vitest';
import type { SheetMeta } from '../../model';
import { readSheet } from './read-sheet';

const META: SheetMeta = {
  v: 1,
  frames: { panel: { states: { normal: [0, 0, 66, 66] }, cuts: [26.4, 26.4, 26.4, 26.4] } },
  sets: { panel: { back: 'panel' } },
};

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Response(text).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(id: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + data.length + (data.length & 1));
  out.set([...id].map((c) => c.charCodeAt(0)));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

/** A WebP-shaped file: the RIFF header, then the chunks given (the picture's are stand-ins). */
function webp(...chunks: Uint8Array[]): ArrayBuffer {
  const body = chunks.reduce((n, c) => n + c.length, 4);
  const out = new Uint8Array(8 + body);
  out.set([...'RIFF'].map((c) => c.charCodeAt(0)));
  new DataView(out.buffer).setUint32(4, body, true);
  out.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
  let at = 12;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

const header = chunk('VP8X', new Uint8Array(10));
const pixels = chunk('VP8L', new Uint8Array(21));

describe('readSheet', () => {
  it('unpacks the metadata and keeps the whole file as the picture', async () => {
    const file = webp(header, chunk('HRSM', await deflate(JSON.stringify(META))), pixels);
    const { meta, image } = await readSheet(file);
    expect(meta).toEqual(META);
    expect(image.type).toBe('image/webp');
    expect(image.size).toBe(file.byteLength);
  });

  it('finds the metadata after the pixels too', async () => {
    const file = webp(header, pixels, chunk('HRSM', await deflate(JSON.stringify(META))));
    expect((await readSheet(file)).meta).toEqual(META);
  });

  it('fails for no metadata, another version or another format', async () => {
    await expect(readSheet(webp(header, pixels))).rejects.toThrow('no metadata');
    const v2 = webp(header, chunk('HRSM', await deflate('{"v":2}')));
    await expect(readSheet(v2)).rejects.toThrow('version 2');
    await expect(readSheet(new Uint8Array(16).buffer)).rejects.toThrow('not a WebP');
  });
});
