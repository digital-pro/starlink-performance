import { get, list } from '@vercel/blob';

if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.PERFORMANCE_READ_WRITE_TOKEN) {
  process.env.BLOB_READ_WRITE_TOKEN = process.env.PERFORMANCE_READ_WRITE_TOKEN;
}

async function readBlobJson(pathname) {
  try {
    const result = await get(pathname, { download: true });
    const text = await result?.blob?.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readFromBlob() {
  try {
    const preferExact = ['benchmarks/runs.json', 'benchmarks/latest.json'];
    for (const key of preferExact) {
      const data = await readBlobJson(key);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    const collected = await list({ prefix: 'benchmarks/' });
    const blobs = collected?.blobs ?? [];
    if (blobs.length === 0) return [];

    const runsCandidate = blobs.find(b => b.pathname.startsWith('benchmarks/runs'));
    if (runsCandidate) {
      const data = await readBlobJson(runsCandidate.pathname);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    const latestCandidate = blobs.find(b => b.pathname.startsWith('benchmarks/latest'));
    if (latestCandidate) {
      const data = await readBlobJson(latestCandidate.pathname);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    const timestamped = blobs
      .filter(b => /benchmarks\/.+\.json$/.test(b.pathname) && !b.pathname.startsWith('benchmarks/runs') && !b.pathname.startsWith('benchmarks/latest'))
      .sort((a, b) => {
        const aTime = parseInt(a.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        const bTime = parseInt(b.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        return bTime - aTime;
      });
    if (timestamped.length === 0) return [];

    const latest = await readBlobJson(timestamped[0].pathname);
    const runs = Array.isArray(latest?.runs) ? latest.runs : (Array.isArray(latest) ? latest : []);
    return runs;
  } catch (e) {
    console.error('Error reading from Vercel Blob:', e);
    return [];
  }
}

async function readMergedRecentFromBlob(maxFiles = 100) {
  try {
    const collected = await list({ prefix: 'benchmarks/' });
    const blobs = collected?.blobs ?? [];
    const candidates = blobs
      .map(b => b.pathname)
      .filter(n => n.endsWith('.json') && !n.startsWith('benchmarks/runs') && !n.startsWith('benchmarks/latest'));
    if (candidates.length === 0) return [];
    const sorted = candidates.sort((a, b) => {
      const aTime = parseInt(a.split('/')[1]?.split('.')[0] || '0', 10);
      const bTime = parseInt(b.split('/')[1]?.split('.')[0] || '0', 10);
      return bTime - aTime;
    }).slice(0, maxFiles);

    const merged = [];
    const seen = new Set();
    for (const name of sorted) {
      try {
        const json = await readBlobJson(name);
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
    console.error('Error merging recent from Vercel Blob:', e);
    return [];
  }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const mem = globalThis.__BENCH_RUNS_CACHE__;
    let arr = Array.isArray(mem) ? mem : null;

    if (!arr || arr.length === 0) arr = await readFromBlob();
    if (!arr || arr.length === 0) arr = await readMergedRecentFromBlob(150);

    const items = (Array.isArray(arr) ? arr : []).map((r) => {
      const start = typeof r.start === 'number' ? r.start : (Date.parse(r.timestamp || '') || null);
      const end = typeof r.end === 'number' ? r.end : (Date.parse(r.finishedAt || '') || null);
      const metadata = r.metadata && typeof r.metadata === 'object' ? r.metadata : {};
      return {
        ...r,
        task: typeof r.task === 'string' && r.task.trim() ? r.task.trim() : 'unknown',
        start,
        end,
        metadata,
      };
    }).filter(x => Number.isFinite(x.start) && Number.isFinite(x.end));

    res.status(200).json({ ok: true, runs: items });
  } catch (e) {
    console.error('bench-runs error:', e);
    res.status(200).json({ ok: true, runs: [] });
  }
}


