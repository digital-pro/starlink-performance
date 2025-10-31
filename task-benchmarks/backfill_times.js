import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const runsJsonPath = path.join(projectRoot, 'cypress', 'timing', 'runs.json');

function formatPacificTime(date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

async function main() {
  const raw = await fs.readFile(runsJsonPath, 'utf8');
  let arr = [];
  try {
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch {
    console.error('runs.json is not valid JSON array. Aborting.');
    process.exit(1);
  }

  let updated = 0;
  for (const rec of arr) {
    try {
      if (!rec) continue;
      const started = rec.timestamp ? new Date(rec.timestamp) : undefined;
      const realSec = typeof rec.realSeconds === 'number' ? rec.realSeconds : undefined;
      if (started && realSec && !rec.finishedAt) {
        const finished = new Date(started.getTime() + realSec * 1000);
        rec.finishedAt = finished.toISOString();
      }
      if (started && !rec.startPT) {
        rec.startPT = `${formatPacificTime(started)} PT`;
      }
      if (!rec.finishPT) {
        const finished = rec.finishedAt ? new Date(rec.finishedAt) : (started ? new Date(started.getTime() + (realSec || 0) * 1000) : undefined);
        if (finished) rec.finishPT = `${formatPacificTime(finished)} PT`;
      }
      updated += 1;
    } catch (e) {
      // continue
    }
  }

  await fs.writeFile(runsJsonPath, `${JSON.stringify(arr, null, 2)}\n`, 'utf8');
  console.log(`Backfilled ${updated} records.`);
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exitCode = 1;
});


