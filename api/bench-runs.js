import { list } from '@vercel/blob';

if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.PERFORMANCE_READ_WRITE_TOKEN) {
  process.env.BLOB_READ_WRITE_TOKEN = process.env.PERFORMANCE_READ_WRITE_TOKEN;
}

const PUBLIC_BASE_URL = (process.env.BLOB_PUBLIC_BASE_URL || '').replace(/\/$/, '');

async function fetchJson(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function sortByUploadedAtDesc(blobs = []) {
  return [...blobs].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
}

async function readFromBlob() {
  try {
    const collected = await list({ prefix: 'benchmarks/' });
    const blobs = collected?.blobs ?? [];
    if (blobs.length === 0) return [];

    const grouped = new Map();
    for (const blob of blobs) {
      if (!blob?.pathname) continue;
      const existing = grouped.get(blob.pathname) || [];
      existing.push(blob);
      grouped.set(blob.pathname, existing);
    }

    const preferExact = ['benchmarks/runs.json', 'benchmarks/latest.json'];
    for (const key of preferExact) {
      const candidates = grouped.get(key);
      if (candidates && candidates.length) {
        for (const blob of sortByUploadedAtDesc(candidates)) {
          const data = await fetchJson(blob.url);
          if (Array.isArray(data?.runs)) return data.runs;
          if (Array.isArray(data)) return data;
        }
      }
    }

    const runsCandidates = blobs.filter(b => b.pathname.startsWith('benchmarks/runs'));
    for (const blob of sortByUploadedAtDesc(runsCandidates)) {
      const data = await fetchJson(blob.url);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    const latestCandidates = blobs.filter(b => b.pathname.startsWith('benchmarks/latest'));
    for (const blob of sortByUploadedAtDesc(latestCandidates)) {
      const data = await fetchJson(blob.url);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    const timestamps = blobs
      .filter(b => /benchmarks\/.+\.json$/.test(b.pathname) && !b.pathname.startsWith('benchmarks/runs') && !b.pathname.startsWith('benchmarks/latest'))
      .sort((a, b) => {
        const aTime = parseInt(a.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        const bTime = parseInt(b.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        return bTime - aTime;
      });
    if (timestamps.length > 0) {
      const data = await fetchJson(timestamps[0].url);
      if (Array.isArray(data?.runs)) return data.runs;
      if (Array.isArray(data)) return data;
    }

    if (PUBLIC_BASE_URL) {
      for (const key of preferExact) {
        const data = await fetchJson(`${PUBLIC_BASE_URL}/${key}`);
        if (Array.isArray(data?.runs)) return data.runs;
        if (Array.isArray(data)) return data;
      }
    }

    return [];
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
      .filter(b => b.pathname.endsWith('.json') && !b.pathname.startsWith('benchmarks/runs') && !b.pathname.startsWith('benchmarks/latest'))
      .sort((a, b) => {
        const aTime = parseInt(a.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        const bTime = parseInt(b.pathname.split('/')[1]?.split('.')[0] || '0', 10);
        return bTime - aTime;
      })
      .slice(0, maxFiles);

    const merged = [];
    const seen = new Set();
    for (const blob of candidates) {
      try {
        const json = await fetchJson(blob.url);
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
    if (PUBLIC_BASE_URL) {
      try {
        const data = await fetchJson(`${PUBLIC_BASE_URL}/benchmarks/runs.json`);
        const runs = Array.isArray(data?.runs) ? data.runs : (Array.isArray(data) ? data : []);
        return runs;
      } catch {}
    }
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


