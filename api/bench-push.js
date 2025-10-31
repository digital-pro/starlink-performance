import { put } from '@vercel/blob';

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

    const safe = body.map(r => ({
      task: String(r.task || 'unknown'),
      start: Number(r.start || Date.parse(r.timestamp || 0)) || Date.now(),
      end: Number(r.end || Date.parse(r.finishedAt || 0)) || Date.now(),
      metadata: r.metadata || {}
    })).filter(x => Number.isFinite(x.start) && Number.isFinite(x.end));

    const timestamp = Date.now();
    const payloadObject = {
      timestamp: new Date().toISOString(),
      runs: safe
    };
    const payload = JSON.stringify(payloadObject, null, 2);

    const objectKey = `benchmarks/${timestamp}.json`;

    await put(objectKey, payload, {
      access: 'private',
      contentType: 'application/json',
      cacheControl: 'no-store'
    });

    await put('benchmarks/latest.json', payload, {
      access: 'private',
      contentType: 'application/json',
      cacheControl: 'no-store'
    });

    await put('benchmarks/runs.json', JSON.stringify(safe, null, 2), {
      access: 'private',
      contentType: 'application/json',
      cacheControl: 'no-store'
    });

    globalThis.__BENCH_RUNS_CACHE__ = safe;

    res.status(200).json({ ok: true, count: safe.length, stored: objectKey });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}


