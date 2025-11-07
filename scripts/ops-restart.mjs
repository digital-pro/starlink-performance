import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const secretsDir = join(repoRoot, 'secrets');
const logsDir = join(repoRoot, 'logs');

const exec = promisify(execCb);

function dquote(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;
}

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd, { env: process.env, cwd: repoRoot });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return { stdout, stderr };
}

function parseEnvFromFile(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

async function getInstanceId() {
  if (process.env.INSTANCE_ID && process.env.INSTANCE_ID.trim()) return process.env.INSTANCE_ID.trim();
  try {
    const text = await readFile(join(secretsDir, 'grafana_env.txt'), 'utf8');
    const envs = parseEnvFromFile(text);
    if (envs.PROM_USER && envs.PROM_USER.trim()) return envs.PROM_USER.trim();
  } catch {}
  throw new Error('INSTANCE_ID not set. Set env INSTANCE_ID or add PROM_USER to secrets/grafana_env.txt');
}

async function getStarlinkTarget() {
  if (process.env.STARLINK_TARGET && process.env.STARLINK_TARGET.trim()) return process.env.STARLINK_TARGET.trim();
  try {
    const text = await readFile(join(secretsDir, 'starlink_target.txt'), 'utf8');
    const target = text.trim();
    if (target) return target;
  } catch {}
  return '127.0.0.1:9817';
}

async function waitForTargets({ timeoutMs = 60000, job } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:9090/api/v1/targets');
      if (res.ok) {
        const json = await res.json();
        const data = json?.data || {};
        if (!job) return data;
        const active = Array.isArray(data.activeTargets) ? data.activeTargets : [];
        const match = active.find(t => (t?.labels?.job || t?.discoveredLabels?.job) === job);
        if (match) return data;
      }
    } catch (error) {
      if ((Date.now() - start) > 3000) {
        console.log(`...Prometheus not ready yet (${error?.message || error})`);
      }
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    if (elapsed > 0 && elapsed % 5 === 0) {
      const what = job ? `target '${job}'` : 'Prometheus';
      console.log(`...still waiting for ${what} (elapsed ${elapsed}s)`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (job) {
    throw new Error(`Timed out waiting for Prometheus target '${job}'`);
  }
  throw new Error('Timed out waiting for Prometheus targets');
}

(async () => {
  try {
    const instanceId = await getInstanceId();
    const starlinkTarget = await getStarlinkTarget();

    console.log(`Stopping Prometheus (if running)...`);
    try {
      await run(`pkill -f ${dquote(join(logsDir, 'prometheus', 'prometheus'))}`);
    } catch {}

    console.log(`Starting Prometheus with INSTANCE_ID=${instanceId} STARLINK_TARGET=${starlinkTarget} ...`);
    await run(`bash ${dquote(join(repoRoot, 'deployment', 'run-wsl-prom.sh'))} --instance ${instanceId} --starlink ${starlinkTarget} --bg`);

    console.log('Waiting for targets...');
    const data = await waitForTargets({ job: 'starlink' });
    const active = Array.isArray(data.activeTargets) ? data.activeTargets : [];
    let starlink = active.find(t => (t?.labels?.job || t?.discoveredLabels?.job) === 'starlink');

    const getAddress = target => target?.labels?.instance || target?.discoveredLabels?.__address__ || 'unknown';
    let health = starlink?.health || 'unknown';
    const address = getAddress(starlink);
    console.log(`Starlink target detected: ${address} → initial health=${health}`);

    if (health !== 'up') {
      const healthTimeout = Date.now() + 30000;
      while (Date.now() < healthTimeout && health !== 'up') {
        await new Promise(r => setTimeout(r, 2000));
        const retryData = await waitForTargets({ timeoutMs: 5000, job: 'starlink' });
        const retryActive = Array.isArray(retryData.activeTargets) ? retryData.activeTargets : [];
        starlink = retryActive.find(t => (t?.labels?.job || t?.discoveredLabels?.job) === 'starlink') || starlink;
        health = starlink?.health || 'unknown';
        if (health === 'up') break;
        console.log(`...waiting for exporter to become healthy (current health=${health})`);
      }
    }

    console.log(`Starlink target: ${getAddress(starlink)} → health=${health}`);
    if (health !== 'up') {
      console.log('Exporter is still not reporting healthy. Ensure the exporter is running or set STARLINK_TARGET to the correct host:port and rerun.');
    } else {
      console.log('Exporter is Up. Remote write to Grafana Cloud should be active.');
    }
  } catch (err) {
    console.error('ops-restart failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
