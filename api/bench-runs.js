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
    
    // List all benchmark files
    const [files] = await bucket.getFiles({ prefix: 'benchmarks/' });
    
    if (files.length === 0) return [];
    
    // Get the most recent file
    const sortedFiles = files.sort((a, b) => {
      const aTime = parseInt(a.name.split('/')[1]?.split('.')[0] || '0');
      const bTime = parseInt(b.name.split('/')[1]?.split('.')[0] || '0');
      return bTime - aTime;
    });
    
    const latestFile = sortedFiles[0];
    const [content] = await latestFile.download();
    const data = JSON.parse(content.toString());
    return data.runs || [];
  } catch (e) {
    console.error('Error reading from GCS:', e);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    // Prefer in-memory pushed data if present
    const mem = globalThis.__BENCH_RUNS_CACHE__;
    let arr = Array.isArray(mem) ? mem : null;
    
    // Else read from Google Cloud Storage
    if (!arr) arr = await readFromGCS();

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


