/** Regenerate test/fixtures/golden/*.analysis.json.gz from the fixture replays: `pnpm run generate.analysis-goldens`. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  GOLDEN,
  LOCAL,
  goldenName,
  localReplays,
  normalizeLocal,
  runInMemory,
  stable,
} from '../test/util.js';

mkdirSync(GOLDEN, { recursive: true });
const replays = localReplays();
if (replays.length === 0) {
  console.error(
    `no fixture replays in ${LOCAL} — set HRS_REPLAY_FIXTURES or fetch them in heroprotocol`,
  );
  process.exit(1);
}
for (const file of replays) {
  const results = stable(await runInMemory(await normalizeLocal(file)));
  writeFileSync(join(GOLDEN, goldenName(file)), gzipSync(JSON.stringify(results), { level: 9 }));
  console.log(`${file} -> ${goldenName(file)}`);
}
