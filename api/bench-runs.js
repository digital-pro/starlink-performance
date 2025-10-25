import { Storage } from '@google-cloud/storage';

function getStorage() {
  const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY environment variable not set');
  }
  const credentials = JSON.parse(keyJson);
  return new Storage({
    projectId: credentials.project_id,
    credentials
  });
}

async function readFromGCS() {
  try {
    const bucketName = process.env.GCP_BUCKET_NAME || 'levante-performance-dev';
    const storage = getStorage();
    const bucket = storage.bucket(bucketName);
    // Prefer a stable pointer first
    const latestPtr = bucket.file('benchmarks/latest.json');
    const [exists] = await latestPtr.exists();
    if (exists) {
      const [content] = await latestPtr.download();
      const data = JSON.parse(content.toString());
      return Array.isArray(data?.runs) ? data.runs : [];
    }

    // Fallback: list timestamped files and pick newest
    const [files] = await bucket.getFiles({ prefix: 'benchmarks/' });
    if (files.length === 0) return [];
    const sortedFiles = files
      .filter(f => /benchmarks\/.+\.json$/.test(f.name))
      .sort((a, b) => {
        const aTime = parseInt(a.name.split('/')[1]?.split('.')[0] || '0');
        const bTime = parseInt(b.name.split('/')[1]?.split('.')[0] || '0');
        return bTime - aTime;
      });
    const latestFile = sortedFiles[0];
    const [content] = await latestFile.download();
    const data = JSON.parse(content.toString());
    return Array.isArray(data?.runs) ? data.runs : [];
  } catch (e) {
    console.error('Error reading from GCS:', e);
    return [];
  }
}

async function readMergedRecentFromGCS(maxFiles = 100) {
  try {
    const bucketName = process.env.GCP_BUCKET_NAME || 'levante-performance-dev';
    const storage = getStorage();
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: 'benchmarks/' });
    const candidates = files
      .map(f => f.name)
      .filter(n => n.endsWith('.json') && n !== 'benchmarks/latest.json');
    if (candidates.length === 0) return [];
    const sorted = candidates.sort((a, b) => {
      const aTime = parseInt(a.split('/')[1]?.split('.')[0] || '0');
      const bTime = parseInt(b.split('/')[1]?.split('.')[0] || '0');
      return bTime - aTime;
    }).slice(0, maxFiles);
    const merged = [];
    const seen = new Set();
    for (const name of sorted) {
      try {
        const [buf] = await bucket.file(name).download();
        const json = JSON.parse(buf.toString());
        const runs = Array.isArray(json) ? json : (Array.isArray(json?.runs) ? json.runs : []);
        for (const r of runs) {
          const key = `${r.task || 'run'}:${r.start}:${r.end}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(r);
        }
      } catch {}
    }
    return merged;
  } catch (e) {
    console.error('Error merging recent from GCS:', e);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    // Prefer in-memory pushed data if present
    const mem = globalThis.__BENCH_RUNS_CACHE__;
    let arr = Array.isArray(mem) ? mem : null;
    
    // Else read merged recent files from Google Cloud Storage
    if (!arr) arr = await readMergedRecentFromGCS(150);
    // Fallback to pointer/newest single file
    if (!arr || arr.length === 0) arr = await readFromGCS();

    const items = (Array.isArray(arr) ? arr : []).map(r => ({
      task: r.task || 'unknown',
      start: typeof r.start === 'number' ? r.start : (Date.parse(r.timestamp || '') || null),
      end: typeof r.end === 'number' ? r.end : (Date.parse(r.finishedAt || '') || null),
      metadata: r.metadata || {}
    })).filter(x => x.start && x.end);
    
    res.status(200).json({ ok: true, runs: items });
  } catch (e) {
    console.error('bench-runs error:', e);
    res.status(200).json({ ok: true, runs: [] });
  }
}


