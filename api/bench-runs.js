import { promises as fs } from 'fs';
import path from 'path';

async function readFromRepo() {
  try {
    const base = process.cwd();
    const runsPath = path.join(base, 'task-benchmarks', 'runs.json');
    const text = await fs.readFile(runsPath, 'utf8').catch(() => '[]');
    return JSON.parse(text || '[]');
  } catch {
    return [];
  }
}

async function readFromGist() {
  const gistId = process.env.BENCH_GIST_ID;
  if (!gistId) return null;
  try {
    const r = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) return null;
    const j = await r.json();
    const files = j?.files || {};
    const file = Object.values(files)[0];
    const content = file?.content || '[]';
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Prefer in-memory pushed data if present
    const mem = globalThis.__BENCH_RUNS_CACHE__;
    let arr = Array.isArray(mem) ? mem : null;
    // Else try gist if configured
    if (!arr) arr = await readFromGist();
    // Else fall back to bundled repo file (updated on deploy)
    if (!arr) arr = await readFromRepo();

    const items = (Array.isArray(arr) ? arr : []).map(r => ({
      task: r.task || 'unknown',
      start: typeof r.start === 'number' ? r.start : (Date.parse(r.timestamp || '') || null),
      end: typeof r.end === 'number' ? r.end : (Date.parse(r.finishedAt || '') || null)
    })).filter(x => x.start && x.end);
    res.status(200).json({ ok: true, runs: items });
  } catch (e) {
    res.status(200).json({ ok: true, runs: [] });
  }
}


