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

async function exporterFreshnessOk() {
  // If exporter /metrics lacks updates for >60s, consider stale
  const r = await httpGet('http://127.0.0.1:9090/api/v1/query?query=timestamp(starlink_latency_ms)', 1500);
  try {
    if (!r.ok) return true; // don't flap on prom errors
    const body = JSON.parse(r.text || '{}');
    const ts = body?.data?.result?.[0]?.value?.[1];
    const tNum = Number(ts);
    if (!Number.isFinite(tNum)) return true;
    const ageSec = Math.max(0, Date.now() / 1000 - tNum);
    return ageSec < 90;
  } catch {
    return true;
  }
}

async function startExporter() {
  // Try existing binary first; build if missing
  const bin = '/home/djc/levante/levante-performance/logs/starlink_exporter';
  await run('mkdir -p /home/djc/levante/levante-performance/logs');
  try {
    await run(`test -x ${bin} || (cd /home/djc/starlink_exporter && go build -o ${bin} ./cmd/starlink_exporter)`);
  } catch {}
  const dishAddr = process.env.STARLINK_DISH_ADDR || '192.168.100.1:9201';
  await run(`nohup ${bin} -address ${dishAddr} -port 9817 > /home/djc/levante/levante-performance/logs/starlink_exporter.out 2>&1 & echo $! > /home/djc/levante/levante-performance/logs/starlink_exporter.pid`);
}

async function restartProm() {
  await run('node /home/djc/levante/levante-performance/scripts/ops-restart.mjs');
}

(async () => {
  const starlinkTarget = await getStarlinkTarget();
  let exporterFail = 0;
  let promFail = 0;
  let staleFail = 0;
  const intervalMs = 10000; // 10s checks
  for (;;) {
    try {
      const [eUp, pUp, fresh] = await Promise.all([
        isExporterUp(starlinkTarget),
        isPrometheusUp(),
        exporterFreshnessOk()
      ]);

      if (!eUp) exporterFail++; else exporterFail = 0;
      if (!pUp) promFail++; else promFail = 0;
      if (!fresh) staleFail++; else staleFail = 0;

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

      if (staleFail >= 6) { // ~1 minute stale
        console.log(`[watchdog] Exporter metrics stale. Restarting exporter...`);
        staleFail = 0;
        await startExporter();
        await sleep(1500);
      }
    } catch (err) {
      console.error('[watchdog] error:', err && err.message ? err.message : err);
    }
    await sleep(intervalMs);
  }
})();


