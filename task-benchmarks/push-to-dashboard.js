#!/usr/bin/env node
/**
 * Push benchmark timing data to the Levante Performance dashboard
 * Reads from runs.ndjson and POSTs to /api/bench-push
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.DASHBOARD_URL || 'https://levante-performance.vercel.app';

async function readNdjson() {
  const ndjsonPath = path.join(__dirname, 'runs.ndjson');
  try {
    const content = await fs.readFile(ndjsonPath, 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (e) {
    console.error('Error reading runs.ndjson:', e.message);
    return [];
  }
}

async function pushToDashboard(runs) {
  const url = `${API_URL}/api/bench-push`;
  
  // Transform to expected schema
  const payload = runs.map(r => ({
    task: r.task || 'unknown',
    start: Date.parse(r.timestamp) || Date.now(),
    end: Date.parse(r.finishedAt) || Date.now(),
    metadata: {
      status: r.status,
      realSeconds: r.realSeconds,
      cypressDurationMs: r.cypressDurationMs,
      spec: r.spec,
      provider: r.provider,
      totals: r.totals
    }
  }));

  console.log(`Pushing ${payload.length} benchmark runs to ${url}...`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    
    const result = await response.json();
    console.log('✅ Success!', result);
    return result;
  } catch (e) {
    console.error('❌ Error pushing to dashboard:', e.message);
    throw e;
  }
}

async function main() {
  const runs = await readNdjson();
  if (runs.length === 0) {
    console.log('No runs found in runs.ndjson');
    return;
  }
  
  console.log(`Found ${runs.length} benchmark runs`);
  await pushToDashboard(runs);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

