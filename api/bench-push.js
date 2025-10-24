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
    })).filter(x => x.start && x.end);
    globalThis.__BENCH_RUNS_CACHE__ = safe;
    res.status(200).json({ ok: true, count: safe.length });
  } catch (e) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
}


