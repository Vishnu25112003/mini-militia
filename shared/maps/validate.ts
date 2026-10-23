// Build-time map check:  npm run validate-map -w @game/shared   (runs automatically in `npm run build`)
// Exits with code 1 if any check fails, so a broken map can never be built or deployed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMap, type TiledMapJson } from './loadMap';
import { validateMap } from './validateMap';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, 'catacombs.json');
const report = validateMap(loadMap(JSON.parse(fs.readFileSync(file, 'utf8')) as TiledMapJson));

const s = report.stats;
console.log(
  `[map] ${path.basename(file)}: ${s.spawnPoints} spawn points, ${s.pickupSpots} pickup spots, ` +
    `min spawn-pickup distance ${s.minSpawnPickupDistancePx.toFixed(0)} px, ` +
    `${s.reachablePositions}/${s.freePositions} open positions reachable`,
);
if (!report.ok) {
  for (const e of report.errors) console.error(`[map] FAIL: ${e}`);
  process.exit(1);
}
console.log('[map] all checks passed');
