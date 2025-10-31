import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const exec = promisify(execCb);

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd, { env: process.env });
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
    const text = await readFile('/home/djc/levante/starlink-performance/secrets/grafana_env.txt', 'utf8');
    const envs = parseEnvFromFile(text);
    if (envs.PROM_USER && envs.PROM_USER.trim()) return envs.PROM_USER.trim();
  } catch {}
  throw new Error('INSTANCE_ID not set. Set env INSTANCE_ID or add PROM_USER to secrets/grafana_env.txt');
}

async function getStarlinkTarget() {
  if (process.env.STARLINK_TARGET && process.env.STARLINK_TARGET.trim()) return process.env.STARLINK_TARGET.trim();
  try {
    const text = await readFile('/home/djc/levante/starlink-performance/secrets/starlink_target.txt', 'utf8');
    const target = text.trim();
    if (target) return target;
  } catch {}
  return '127.0.0.1:9817';
}

async function waitForTargets(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:9090/api/v1/targets');
      if (res.ok) {
        const json = await res.json();
        return json?.data || {};
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Timed out waiting for Prometheus targets');
}

(async () => {
  try {
    const instanceId = await getInstanceId();
    const starlinkTarget = await getStarlinkTarget();

    console.log(`Stopping Prometheus (if running)...`);
    try {
      await run("pkill -f '/home/djc/levante/starlink-performance/logs/prometheus/prometheus'");
    } catch {}

    console.log(`Starting Prometheus with INSTANCE_ID=${instanceId} STARLINK_TARGET=${starlinkTarget} ...`);
    await run(`bash /home/djc/levante/starlink-performance/deployment/run-wsl-prom.sh --instance ${instanceId} --starlink ${starlinkTarget} --bg`);

    console.log('Waiting for targets...');
    const data = await waitForTargets();
    const active = Array.isArray(data.activeTargets) ? data.activeTargets : [];
    const starlink = active.find(t => (t?.labels?.job || t?.discoveredLabels?.job) === 'starlink');

    if (!starlink) {
      console.log('No starlink target discovered yet. Check prom logs: npm run prom:logs');
      process.exit(0);
    }

    const health = starlink.health || 'unknown';
    console.log(`Starlink target: ${starlink.labels?.instance || starlink.discoveredLabels?.__address__} → health=${health}`);
    if (health !== 'up') {
      console.log('Exporter is not reachable. Ensure the exporter is running or set STARLINK_TARGET to the correct host:port and rerun.');
    } else {
      console.log('Exporter is Up. Remote write to Grafana Cloud should be active.');
    }
  } catch (err) {
    console.error('ops-restart failed:', err?.message || err);
    process.exitCode = 1;
  }
})();
