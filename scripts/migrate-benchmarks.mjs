#!/usr/bin/env node

/**
 * Migrate benchmark run history between Vercel deployments.
 *
 * Pulls run data from a source deployment (`/api/bench-runs`) and pushes any
 * missing entries to the destination deployment (`/api/bench-push`). This is
 * useful when a project is renamed and receives a fresh Blob storage bucket.
 *
 * Usage examples:
 *   node scripts/migrate-benchmarks.mjs \
 *     --source https://starlink-performance.vercel.app \
 *     --dest https://starlink-performance-digitalpros-projects.vercel.app
 *
 *   node scripts/migrate-benchmarks.mjs --dry-run
 */

const defaultSource = 'https://starlink-performance.vercel.app';
const defaultDestination = 'https://starlink-performance-digitalpros-projects.vercel.app';

function parseArgs() {
  const pairs = new Map();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      pairs.set(key, next);
      i += 1;
    } else {
      pairs.set(key, 'true');
    }
  }
  return pairs;
}

function normalizeBase(url) {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function getRuns(baseUrl) {
  const url = `${normalizeBase(baseUrl)}/api/bench-runs`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to fetch runs from ${url}: ${res.status} ${res.statusText} ${detail}`);
  }
  const payload = await res.json();
  if (!payload || !Array.isArray(payload.runs)) {
    throw new Error(`Unexpected response from ${url} (missing runs array).`);
  }
  return payload.runs.map((run) => ({
    ...run,
    task: typeof run.task === 'string' && run.task.trim() ? run.task.trim() : 'run',
    start: Number(run.start),
    end: Number(run.end)
  })).filter((run) => Number.isFinite(run.start) && Number.isFinite(run.end));
}

function runKey(run) {
  return `${run.task}:${run.start}:${run.end}`;
}

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

async function pushRuns(baseUrl, runs) {
  if (!Array.isArray(runs) || runs.length === 0) return;
  const url = `${normalizeBase(baseUrl)}/api/bench-push`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(runs)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Failed to push runs to ${url}: ${res.status} ${res.statusText} ${detail}`);
  }
  const payload = await res.json().catch(() => ({}));
  if (!payload?.ok) {
    throw new Error(`Destination responded without ok=true (${JSON.stringify(payload)})`);
  }
  return payload;
}

(async () => {
  try {
    const args = parseArgs();
    const dryRun = args.get('dry-run') === 'true';
    const sourceBase = normalizeBase(args.get('source') || process.env.BENCH_SOURCE || defaultSource);
    const destBase = normalizeBase(args.get('dest') || process.env.BENCH_DEST || defaultDestination);

    if (sourceBase === destBase) {
      throw new Error('Source and destination deployments must differ.');
    }

    console.log(`🔍 Fetching runs from source: ${sourceBase}`);
    const sourceRuns = await getRuns(sourceBase);
    console.log(`   Found ${sourceRuns.length} run(s) in source.`);

    console.log(`🔍 Fetching runs from destination: ${destBase}`);
    const destRuns = await getRuns(destBase);
    console.log(`   Destination currently has ${destRuns.length} run(s).`);

    const destKeys = new Set(destRuns.map(runKey));
    const missing = sourceRuns.filter((run) => !destKeys.has(runKey(run)));

    if (missing.length === 0) {
      console.log('✅ Destination already contains all source runs. Nothing to migrate.');
      return;
    }

    console.log(`➡️  ${missing.length} run(s) are missing at the destination.`);
    if (dryRun) {
      console.log('Dry run enabled – skipping upload.');
      return;
    }

    const batches = chunk(missing, 50);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      console.log(`   Uploading batch ${i + 1}/${batches.length} (${batch.length} run(s))...`);
      await pushRuns(destBase, batch);
    }

    console.log('✅ Migration complete. Verify with:');
    console.log(`   curl -fsS ${destBase}/api/bench-runs | jq '.runs | length'`);
  } catch (error) {
    console.error(`❌ ${error?.message || error}`);
    process.exitCode = 1;
  }
})();


