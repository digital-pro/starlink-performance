#!/usr/bin/env node
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const exec = promisify(execCb);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd, { env: process.env });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return { stdout, stderr };
}

async function getStarlinkTarget() {
  try {
    const text = await readFile('/home/djc/levante/levante-performance/secrets/starlink_target.txt', 'utf8');
    const t = text.trim();
    if (t) return t;
  } catch {}
  return '127.0.0.1:9817';
}

async function httpGet(url, timeoutMs = 2000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

async function isExporterUp(hostPort) {
  const { ok, text } = await httpGet(`http://${hostPort}/metrics`, 1500);
  return ok && typeof text === 'string' && text.includes('starlink_dish');
}

async function isPrometheusUp() {
  const r = await httpGet('http://127.0.0.1:9090/-/ready', 1200);
  if (r.ok) return true;
  const t = await httpGet('http://127.0.0.1:9090/api/v1/targets', 1500);
  return t.ok;
}

async function startExporter() {
  // Try existing binary first; build if missing
  const bin = '/home/djc/levante/levante-performance/logs/starlink_exporter';
  await run('mkdir -p /home/djc/levante/levante-performance/logs');
  try {
    await run(`test -x ${bin} || (cd /home/djc/starlink_exporter && go build -o ${bin} ./cmd/starlink_exporter)`);
  } catch {}
  await run(`nohup ${bin} -port 9817 > /home/djc/levante/levante-performance/logs/starlink_exporter.out 2>&1 & echo $! > /home/djc/levante/levante-performance/logs/starlink_exporter.pid`);
}

async function restartProm() {
  await run('node /home/djc/levante/levante-performance/scripts/ops-restart.mjs');
}

(async () => {
  const starlinkTarget = await getStarlinkTarget();
  let exporterFail = 0;
  let promFail = 0;
  const intervalMs = 10000; // 10s checks
  for (;;) {
    try {
      const [eUp, pUp] = await Promise.all([
        isExporterUp(starlinkTarget),
        isPrometheusUp()
      ]);

      if (!eUp) exporterFail++; else exporterFail = 0;
      if (!pUp) promFail++; else promFail = 0;

      if (exporterFail >= 2) {
        console.log(`[watchdog] Exporter down. Restarting exporter...`);
        exporterFail = 0;
        await startExporter();
        await sleep(1500);
      }

      if (promFail >= 2) {
        console.log(`[watchdog] Prometheus not ready. Restarting stack...`);
        promFail = 0;
        await restartProm();
        await sleep(2000);
      }
    } catch (err) {
      console.error('[watchdog] error:', err && err.message ? err.message : err);
    }
    await sleep(intervalMs);
  }
})();


