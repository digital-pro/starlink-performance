import { put } from '@vercel/blob';

if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.PERFORMANCE_READ_WRITE_TOKEN) {
  process.env.BLOB_READ_WRITE_TOKEN = process.env.PERFORMANCE_READ_WRITE_TOKEN;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ error: 'Expected JSON array of runs' });
      return;
    }

    const runs = body
      .filter(r => r && typeof r === 'object')
      .map((raw) => {
        const task = typeof raw.task === 'string' && raw.task.trim() ? raw.task.trim() : 'unknown';
        const timestamp = raw.timestamp || new Date().toISOString();
        const finishedAt = raw.finishedAt || raw.completedAt || timestamp;
        const start = Number.isFinite(raw.start) ? raw.start : Date.parse(timestamp) || Date.now();
        const end = Number.isFinite(raw.end) ? raw.end : Date.parse(finishedAt) || start;
        const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};

        return {
          ...raw,
          task,
          timestamp,
          finishedAt,
          start,
          end,
          metadata,
        };
      })
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end));

    if (runs.length === 0) {
      res.status(400).json({ error: 'No valid benchmark runs in payload' });
      return;
    }

    const timestamp = Date.now();
    const payloadObject = {
      timestamp: new Date().toISOString(),
      runs
    };
    const payload = JSON.stringify(payloadObject, null, 2);

    const objectKey = `benchmarks/${timestamp}.json`;

    await put(objectKey, payload, {
      access: 'public',
      contentType: 'application/json',
      cacheControl: 'no-store',
      addRandomSuffix: false
    });

    await put('benchmarks/latest.json', payload, {
      access: 'public',
      contentType: 'application/json',
      cacheControl: 'no-store',
      addRandomSuffix: false
    });

    await put('benchmarks/runs.json', JSON.stringify(runs, null, 2), {
      access: 'public',
      contentType: 'application/json',
      cacheControl: 'no-store',
      addRandomSuffix: false
    });

    globalThis.__BENCH_RUNS_CACHE__ = runs;

    res.status(200).json({ ok: true, count: runs.length, stored: objectKey });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}


