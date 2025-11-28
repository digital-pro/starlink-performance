#!/usr/bin/env node
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execCb);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const secretsDir = join(repoRoot, 'secrets');
const logsDir = join(repoRoot, 'logs');
const exporterRepoDefault = resolve(repoRoot, 'starlink_exporter');
const scriptsDir = join(repoRoot, 'scripts');
const wifiExporterTarget = process.env.WIFI_EXPORTER_TARGET || '127.0.0.1:9818';
const speedtestExporterTarget = process.env.SPEEDTEST_EXPORTER_TARGET || '127.0.0.1:9820';
const speedtestIntervalSeconds = Math.max(Number(process.env.SPEEDTEST_INTERVAL_SECONDS || 600), 60);

function dquote(value) {
  return `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;
}

async function run(cmd) {
  const { stdout, stderr } = await exec(cmd, { env: process.env, cwd: repoRoot });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return { stdout, stderr };
}

async function getStarlinkTarget() {
  try {
    const text = await readFile(join(secretsDir, 'starlink_target.txt'), 'utf8');
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

async function isWifiExporterUp(target = wifiExporterTarget) {
  const { ok, text } = await httpGet(`http://${target}/metrics`, 1500);
  if (!ok) return false;
  return typeof text === 'string' && text.includes('windows_wifi_link_speed_mbps');
}

async function wifiExporterFreshnessOk() {
  const r = await httpGet('http://127.0.0.1:9090/api/v1/query?query=timestamp(windows_wifi_link_speed_mbps)', 1500);
  try {
    if (!r.ok) return true;
    const body = JSON.parse(r.text || '{}');
    const results = Array.isArray(body?.data?.result) ? body.data.result : [];
    if (results.length === 0) return false;
    const latestTs = Math.max(
      ...results
        .map((item) => Number(item?.value?.[1]))
        .filter((value) => Number.isFinite(value))
    );
    if (!Number.isFinite(latestTs)) return false;
    const ageSec = Math.max(0, Date.now() / 1000 - latestTs);
    return ageSec < 300;
  } catch {
    return true;
  }
}

async function restartWifiExporter() {
  await run(`bash ${dquote(join(scriptsDir, 'restart-wifi-exporter.sh'))}`);
}

async function isSpeedtestExporterUp(target = speedtestExporterTarget) {
  const { ok, text } = await httpGet(`http://${target}/metrics`, 1500);
  if (!ok) return false;
  return typeof text === 'string' && text.includes('starlink_speedtest_last_run_status');
}

async function speedtestExporterFreshnessOk() {
  const r = await httpGet('http://127.0.0.1:9090/api/v1/query?query=timestamp(starlink_speedtest_last_run_timestamp_seconds)', 1500);
  try {
    if (!r.ok) return true;
    const body = JSON.parse(r.text || '{}');
    const results = Array.isArray(body?.data?.result) ? body.data.result : [];
    if (results.length === 0) return false;
    const latestTs = Math.max(
      ...results
        .map((item) => Number(item?.value?.[1]))
        .filter((value) => Number.isFinite(value))
    );
    if (!Number.isFinite(latestTs) || latestTs === 0) return false;
    const ageSec = Math.max(0, Date.now() / 1000 - latestTs);
    const allowable = Math.max(speedtestIntervalSeconds * 2, 900);
    return ageSec < allowable;
  } catch {
    return true;
  }
}

async function restartSpeedtestExporter() {
  await run(`bash ${dquote(join(scriptsDir, 'restart-speedtest.sh'))}`);
}

async function startExporter() {
  // Try existing binary first; build if missing
  const bin = join(logsDir, 'starlink_exporter');
  await mkdir(logsDir, { recursive: true });
  try {
    const exporterRepo = process.env.STARLINK_EXPORTER_DIR ? resolve(process.env.STARLINK_EXPORTER_DIR) : exporterRepoDefault;
    await run(`test -x ${dquote(bin)} || (cd ${dquote(exporterRepo)} && go build -o ${dquote(bin)} ./cmd/starlink_exporter)`);
  } catch {}
  const dishAddr = process.env.STARLINK_DISH_ADDR || '192.168.100.1:9201';
  await run(`nohup ${dquote(bin)} -address ${dishAddr} -port 9817 > ${dquote(join(logsDir, 'starlink_exporter.out'))} 2>&1 & echo $! > ${dquote(join(logsDir, 'starlink_exporter.pid'))}`);
}

async function restartProm() {
  await run(`node ${dquote(join(repoRoot, 'scripts', 'ops-restart.mjs'))}`);
}

(async () => {
  const starlinkTarget = await getStarlinkTarget();
  let exporterFail = 0;
  let promFail = 0;
  let staleFail = 0;
  let wifiFail = 0;
  let wifiStaleFail = 0;
  let speedFail = 0;
  let speedStaleFail = 0;
  const intervalMs = 10000; // 10s checks
  const wifiStaleThreshold = 6; // ~1 minute
  const speedStaleThreshold = 12; // ~2 minutes
  for (;;) {
    try {
      const [eUp, pUp, fresh, wifiUp, wifiFresh, speedUp, speedFresh] = await Promise.all([
        isExporterUp(starlinkTarget),
        isPrometheusUp(),
        exporterFreshnessOk(),
        isWifiExporterUp(),
        wifiExporterFreshnessOk(),
        isSpeedtestExporterUp(),
        speedtestExporterFreshnessOk()
      ]);

      if (!eUp) exporterFail++; else exporterFail = 0;
      if (!pUp) promFail++; else promFail = 0;
      if (!fresh) staleFail++; else staleFail = 0;
      if (!wifiUp) wifiFail++; else wifiFail = 0;
      if (!wifiFresh) wifiStaleFail++; else wifiStaleFail = 0;
      if (!speedUp) speedFail++; else speedFail = 0;
      if (!speedFresh) speedStaleFail++; else speedStaleFail = 0;

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

      if (wifiFail >= 2) {
        console.log('[watchdog] WiFi exporter down. Restarting...');
        wifiFail = 0;
        await restartWifiExporter();
        await sleep(1000);
      }

      if (wifiStaleFail >= wifiStaleThreshold) {
        console.log('[watchdog] WiFi exporter stale. Restarting...');
        wifiStaleFail = 0;
        await restartWifiExporter();
        await sleep(1000);
      }

      if (speedFail >= 2) {
        console.log('[watchdog] Speedtest exporter down. Restarting...');
        speedFail = 0;
        await restartSpeedtestExporter();
        await sleep(1500);
      }

      if (speedStaleFail >= speedStaleThreshold) {
        console.log('[watchdog] Speedtest exporter stale. Restarting...');
        speedStaleFail = 0;
        await restartSpeedtestExporter();
        await sleep(1500);
      }
    } catch (err) {
      console.error('[watchdog] error:', err && err.message ? err.message : err);
    }
    await sleep(intervalMs);
  }
})();


