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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'Expected JSON array of runs' });
      return;
    }
    
    // Basic schema normalization
    const safe = body.map(r => ({
      task: String(r.task || 'unknown'),
      start: Number(r.start || Date.parse(r.timestamp || 0)) || Date.now(),
      end: Number(r.end || Date.parse(r.finishedAt || 0)) || Date.now(),
      metadata: r.metadata || {}
    })).filter(x => x.start && x.end);

    // Write to Google Cloud Storage
    const bucketName = process.env.GCP_BUCKET_NAME || 'levante-performance-dev';
    const storage = getStorage();
    const bucket = storage.bucket(bucketName);
    const timestamp = Date.now();
    const filename = `benchmarks/${timestamp}.json`;
    
    await bucket.file(filename).save(JSON.stringify({
      timestamp: new Date().toISOString(),
      runs: safe
    }, null, 2), {
      contentType: 'application/json',
      metadata: {
        uploadedAt: new Date().toISOString()
      }
    });

    // Also write/update stable pointer for freshest reads
    try {
      await bucket.file('benchmarks/latest.json').save(JSON.stringify({
        timestamp: new Date().toISOString(),
        runs: safe
      }, null, 2), {
        contentType: 'application/json'
      });
    } catch {}

    // Also keep in memory for immediate reads
    globalThis.__BENCH_RUNS_CACHE__ = safe;
    
    res.status(200).json({ 
      ok: true, 
      count: safe.length,
      stored: filename
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}


