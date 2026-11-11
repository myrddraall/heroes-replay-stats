/**
 * The reference image an editor compares its view against (an editing aid: a picture of the
 * game's own screen, chosen from this computer), kept in this browser's IndexedDB so it is there
 * again after a reload; too big for `localStorage`. Where the database can't be opened nothing is
 * kept and the image lasts the visit.
 */

const STORE = 'aids';
const KEY = 'reference';

/** The image kept: the file as chosen, and its name. */
export interface KeptReference {
  readonly image: Blob;
  readonly name: string;
}

function open(database: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('no database'));
  });
}

/** One request on the aids' store in `database`, its result; null where there is no database. */
async function run<T>(
  database: string,
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  try {
    const db = await open(database);
    return await new Promise<T>((resolve, reject) => {
      const r = request(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('not kept'));
    }).finally(() => db.close());
  } catch {
    return null;
  }
}

/** The reference image kept in `database`, if any. */
export async function loadReference(database: string): Promise<KeptReference | null> {
  const kept: unknown = await run(database, 'readonly', (s) => s.get(KEY));
  return kept && typeof kept === 'object' && 'image' in kept && kept.image instanceof Blob
    ? { image: kept.image, name: 'name' in kept && typeof kept.name === 'string' ? kept.name : '' }
    : null;
}

/** A reference image kept in `database` (in place of any before it). */
export async function keepReference(database: string, reference: KeptReference): Promise<void> {
  await run(database, 'readwrite', (s) => s.put(reference, KEY));
}

/** The reference image no longer kept in `database`. */
export async function forgetReference(database: string): Promise<void> {
  await run(database, 'readwrite', (s) => s.delete(KEY));
}
