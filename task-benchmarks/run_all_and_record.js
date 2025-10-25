import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve where to read/write timing files (local to this script's repo)
const timingDir = path.join(__dirname);
const runsJsonPath = path.join(timingDir, 'runs.json');
const runsNdjsonPath = path.join(timingDir, 'runs.ndjson');
const DEFAULT_PUSH_URL = process.env.DASHBOARD_PUSH_URL || 'https://levante-performance-digitalpros-projects.vercel.app/api/bench-push';

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveProjectRoot() {
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot) {
    // If provided and absolute, use as-is
    if (path.isAbsolute(envRoot)) return envRoot;
    // Try resolving relative to this script's dir (and its parent), not CWD
    const relCandidates = [
      path.resolve(__dirname, envRoot),
      path.resolve(__dirname, '..', envRoot),
      path.resolve(process.cwd(), envRoot)
    ];
    for (const c of relCandidates) {
      if (await pathExists(path.join(c, 'cypress.config.js'))) return c;
    }
    // Fallback to CWD resolution when not found
    return path.resolve(envRoot);
  }
  // Search up to 5 ancestors for sibling core-tasks/task-launcher
  const ancestors = [];
  let cur = __dirname;
  for (let i = 0; i < 5; i++) {
    ancestors.push(cur);
    const next = path.dirname(cur);
    if (next === cur) break;
    cur = next;
  }
  const candidates = [
    // typical mono-repo layout: levante-performance/task-benchmarks → ../../core-tasks/task-launcher
    ...ancestors.map(a => path.resolve(a, 'core-tasks', 'task-launcher')),
    // direct sibling fallback
    path.resolve(__dirname, '..', '..', 'task-launcher'),
  ];
  for (const c of candidates) {
    if (await pathExists(path.join(c, 'cypress.config.js'))) return c;
  }
  // Verbose hint for troubleshooting
  console.warn('[bench] Could not auto-detect PROJECT_ROOT from candidates:', candidates.join(' | '));
  // Prefer sibling core-tasks default if present, otherwise fall back to repo root
  if (await pathExists(path.join(candidates[1], 'cypress.config.js'))) return candidates[1];
  return candidates[0];
}

async function loadCypressFromProject(projectRoot) {
  const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
  return requireFromProject('cypress');
}

function formatMmSs(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = (totalSeconds - m * 60).toFixed(3);
  return `${m}m${s}s`;
}

function formatPacificTime(date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

async function ensureTimingFile() {
  await fs.mkdir(timingDir, { recursive: true });
  try {
    await fs.access(runsJsonPath);
  } catch {
    await fs.writeFile(runsJsonPath, '[]\n', 'utf8');
  }
  // Ensure NDJSON exists (safe append target)
  try {
    await fs.access(runsNdjsonPath);
  } catch {
    await fs.writeFile(runsNdjsonPath, '', 'utf8');
  }
}

async function readJsonArray(filePath) {
  try {
    const txt = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(txt);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filePath, arr) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(arr, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, filePath);
}

async function collectSpecs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const specs = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      specs.push(...(await collectSpecs(full)));
    } else if (e.isFile() && e.name.endsWith('.cy.js') && e.name !== 'helpers.cy.js') {
      specs.push(full);
    }
  }
  return specs;
}

async function detectTaskFromSpec(specPath) {
  try {
    const content = await fs.readFile(specPath, 'utf8');
    const m = content.match(/\?task=([a-z0-9\-]+)/i);
    if (m) return m[1];
  } catch {}
  const base = path.basename(specPath, '.cy.js');
  const special = {
    theory_of_mind: 'theory-of-mind',
    mental_rotation_test: 'mental-rotation',
    matrix_reasoning: 'matrix-reasoning',
    hearts_and_flowers: 'hearts-and-flowers',
    same_different: 'same-different-selection',
    vocab_test: 'vocab',
    trog_test: 'trog',
    memory: 'memory-game',
    math: 'egma-math',
    hostile_attribution: 'hostile-attribution',
  };
  if (special[base]) return special[base];
  return base.replace(/_/g, '-');
}

function deriveProvider() {
  return process.env.PROVIDER || process.env.NET_PROVIDER || process.env.NETWORK_PROVIDER || undefined;
}

async function appendRunRecord(record) {
  const arr = await readJsonArray(runsJsonPath);
  arr.push(record);
  await writeJsonArray(runsJsonPath, arr);
  // Push to dashboard for live overlays (best-effort)
  try {
    await fetch(DEFAULT_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arr)
    }).catch(() => {});
  } catch {}
  // Deploy and alias by default unless disabled
  await maybeDeploy();
}

async function pushAllRunsNow() {
  try {
    const arr = await readJsonArray(runsJsonPath);
    await fetch(DEFAULT_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arr)
    }).catch(() => {});
  } catch {}
}

async function maybeDeploy() {
  const optIn = (String(process.env.ALWAYS_DEPLOY || '').toLowerCase() === '1') || process.argv.includes('--deploy');
  if (!optIn) return; // default: no deploy; opt-in only
  try {
    const repoRoot = path.resolve(__dirname, '..');
    await exec('npm run deploy', { cwd: repoRoot, env: process.env });
  } catch (e) {
    // non-fatal
  }
}

async function appendRunNdjson(record) {
  const line = `${JSON.stringify(record)}\n`;
  await fs.appendFile(runsNdjsonPath, line, 'utf8');
}

async function runSpec(specFullPath, projectRoot, cypressLib) {
  const specRel = path.relative(projectRoot, specFullPath).replace(/\\/g, '/');
  const task = await detectTaskFromSpec(specFullPath);
  const provider = deriveProvider();
  const startedAt = new Date();
  const t0 = Date.now();
  let status = 'error';
  let results = undefined;
  let errorMessage = undefined;
  const wantVideo = (
    String(process.env.VIDEO || '').toLowerCase() === '1' ||
    String(process.env.VIDEO || '').toLowerCase() === 'true' ||
    process.argv.includes('--video')
  );
  const wantVideoCompress = (
    String(process.env.VIDEO_COMPRESS || '').toLowerCase() === '1' ||
    String(process.env.VIDEO_COMPRESS || '').toLowerCase() === 'true' ||
    process.argv.includes('--video-compress')
  ) && wantVideo;
  try {
    results = await cypressLib.run({
      project: projectRoot,
      configFile: path.join(projectRoot, 'cypress.config.js'),
      browser: 'electron',
      headless: true,
      spec: specFullPath,
      config: {
        video: wantVideo, // default off; enable via VIDEO=1 or --video
        videoCompression: wantVideoCompress ? 32 : 0, // disable compression by default (0 = off)
      },
    });
    const ok = results && results.totalFailed === 0 && results.status === 'finished';
    status = ok ? 'passed' : 'failed';
  } catch (err) {
    status = 'error';
    errorMessage = (err && (err.shortMessage || err.message || String(err))).slice(0, 1000);
  }
  const t1 = Date.now();
  const realSeconds = (t1 - t0) / 1000;
  const finishedAt = new Date(startedAt.getTime() + realSeconds * 1000);

  const totals = results
    ? {
        tests: results.totalTests ?? undefined,
        passes: results.totalPassed ?? undefined,
        failures: results.totalFailed ?? undefined,
        pending: results.totalPending ?? undefined,
        skipped: results.totalSkipped ?? undefined,
      }
    : undefined;

  const cypressDurationMs = results?.totalDuration ?? undefined;

  const record = {
    task,
    spec: specRel,
    timestamp: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    status,
    real: formatMmSs(realSeconds),
    realSeconds: Number(realSeconds.toFixed(3)),
    cypressDurationMs,
    totals,
    startPT: `${formatPacificTime(startedAt)} PT`,
    finishPT: `${formatPacificTime(finishedAt)} PT`,
  };
  if (provider) record.provider = provider;
  if (errorMessage) record.error = errorMessage;

  await appendRunRecord(record);
  await appendRunNdjson(record);
  return record;
}

async function main() {
  const only = process.argv.slice(2).find((a) => a && !a.startsWith('--'));
  await ensureTimingFile();
  const projectRoot = await resolveProjectRoot();
  const specsDir = path.join(projectRoot, 'cypress', 'e2e');
  const allSpecs = await collectSpecs(specsDir);
  console.log(`[bench] Discovered ${allSpecs.length} spec files under ${specsDir}`);
  const cypressLib = await loadCypressFromProject(projectRoot);

  const targetSpecs = (function() {
    if (!only) return allSpecs;
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const needle = normalize(only);
    const matched = allSpecs.filter((p) => {
      const base = path.basename(p).replace(/\.cy\.(js|ts)$/i, '');
      const hay = normalize(base);
      return hay.includes(needle);
    });
    console.log(`[bench] Filter '${only}' matched ${matched.length} specs.`);
    return matched;
  })();

  if (targetSpecs.length === 0) {
    console.log('No Cypress specs found.');
    await pushAllRunsNow();
    return;
  }

  console.log(`Found ${targetSpecs.length} specs.`);
  // Heartbeat: push latest runs every 30s during long batches
  let hb;
  if (targetSpecs.length > 1) {
    hb = setInterval(() => { pushAllRunsNow(); }, 30000);
  }
  for (const spec of targetSpecs) {
    console.log(`\n>>> Running: ${path.relative(projectRoot, spec)}`);
    try {
      const rec = await runSpec(spec, projectRoot, cypressLib);
      console.log(`Status: ${rec.status} | real=${rec.real}`);
    } catch (e) {
      console.error(`Error running ${spec}:`, e?.message || e);
      // continue to next spec
    }
  }
  if (hb) clearInterval(hb);
  await pushAllRunsNow();
  console.log('\nAll done. Results appended to cypress/timing/runs.json');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});


