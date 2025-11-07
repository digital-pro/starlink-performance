#!/usr/bin/env node
import http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SPEEDTEST_BINARY = process.env.SPEEDTEST_BINARY || 'iperf3';
const PRIMARY_SERVER = process.env.SPEEDTEST_SERVER || 'cardinalphoto.com';
const PRIMARY_PORT = Number(process.env.SPEEDTEST_PORT || 5201);
const FALLBACKS = (process.env.SPEEDTEST_SERVER_FALLBACKS || 'ping.online.net:5202,iperf.he.net:5201').split(',').map((s) => s.trim()).filter(Boolean);
const SERVER_POOL = [
  `${PRIMARY_SERVER}:${PRIMARY_PORT || 5201}`,
  ...FALLBACKS
].reduce((acc, entry) => {
  const [host, portRaw] = entry.split(':');
  const hostTrim = host?.trim();
  const port = Number(portRaw || 5201);
  if (!hostTrim) return acc;
  const key = `${hostTrim}:${Number.isFinite(port) ? port : 5201}`;
  if (acc.find((item) => item.key === key)) return acc;
  acc.push({ host: hostTrim, port: Number.isFinite(port) ? port : 5201, key });
  return acc;
}, []);

if (SERVER_POOL.length === 0) {
  throw new Error('No speedtest servers configured. Provide SPEEDTEST_SERVER or SPEEDTEST_SERVER_FALLBACKS.');
}

let activeServerIndex = 0;

const SPEEDTEST_EXPORTER_PORT = Number(process.env.SPEEDTEST_EXPORTER_PORT || 9820);
const SPEEDTEST_INTERVAL_SECONDS = Math.max(Number(process.env.SPEEDTEST_INTERVAL_SECONDS || 900), 60);
const SPEEDTEST_DURATION_SECONDS = Math.max(Number(process.env.SPEEDTEST_DURATION_SECONDS || 10), 5);
const EXTRA_ARGS = process.env.SPEEDTEST_ADDITIONAL_ARGS ? process.env.SPEEDTEST_ADDITIONAL_ARGS.split(' ').filter(Boolean) : [];

const state = {
  lastRunStart: null,
  lastRunEnd: null,
  lastSuccess: null,
  lastDuration: 0,
  downloadMbps: Number.NaN,
  uploadMbps: Number.NaN,
  status: 0,
  lastError: '',
  server: SERVER_POOL[activeServerIndex]
};

function formatNumber(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : Number.NaN;
}

function log(message, ...args) {
  const stamp = new Date().toISOString();
  console.log(`[iperf-exporter ${stamp}] ${message}`, ...args);
}

async function runIperf(server, { reverse }) {
  const args = ['-c', server.host, '--json', '--time', String(SPEEDTEST_DURATION_SECONDS)];
  if (Number.isFinite(server.port) && server.port !== 5201) {
    args.push('-p', String(server.port));
  }
  if (reverse) args.push('-R');
  if (EXTRA_ARGS.length > 0) args.push(...EXTRA_ARGS);

  const timeoutMs = (SPEEDTEST_DURATION_SECONDS + 10) * 1000;
  try {
    const { stdout } = await execFileAsync(SPEEDTEST_BINARY, args, { timeout: timeoutMs });
    return JSON.parse(stdout.trim());
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    try {
      if (stdout.trim()) {
        return JSON.parse(stdout.trim());
      }
    } catch {}
    const stderr = error.stderr?.toString?.().trim();
    throw new Error(`iperf3 ${reverse ? 'download' : 'upload'} failed: ${error.message}${stderr ? ` (${stderr})` : ''}`);
  }
}

function extractMbps(result, reverse) {
  if (!result || !result.end) return Number.NaN;
  if (Array.isArray(result?.start?.connected) && result.start.connected.length === 0 && result.error) {
    throw new Error(result.error);
  }
  const sum = reverse ? result.end.sum_received || result.end.sum : result.end.sum_sent || result.end.sum;
  if (!sum || typeof sum.bits_per_second !== 'number') return Number.NaN;
  return sum.bits_per_second / 1e6;
}

async function runTestAgainstServer(server) {
  const downloadResult = await runIperf(server, { reverse: true });
  const downloadMbps = extractMbps(downloadResult, true);
  if (!Number.isFinite(downloadMbps) || downloadMbps <= 0) {
    log('Download result invalid', { server, downloadResult });
    throw new Error(`iperf3 returned invalid download throughput: ${downloadMbps}`);
  }

  const uploadResult = await runIperf(server, { reverse: false });
  const uploadMbps = extractMbps(uploadResult, false);
  if (!Number.isFinite(uploadMbps) || uploadMbps <= 0) {
    log('Upload result invalid', { server, uploadResult });
    throw new Error(`iperf3 returned invalid upload throughput: ${uploadMbps}`);
  }

  return { downloadMbps, uploadMbps };
}

async function runTestCycle() {
  const start = Date.now();
  state.lastRunStart = start / 1000;
  state.status = 0;
  state.lastError = '';

  let attempts = 0;
  let lastError = null;
  while (attempts < SERVER_POOL.length) {
    const serverIndex = (activeServerIndex + attempts) % SERVER_POOL.length;
    const server = SERVER_POOL[serverIndex];
    try {
      const { downloadMbps, uploadMbps } = await runTestAgainstServer(server);
      state.downloadMbps = downloadMbps;
      state.uploadMbps = uploadMbps;
      state.lastSuccess = Date.now() / 1000;
      state.status = 1;
      state.server = server;
      activeServerIndex = serverIndex;
      log(`Speedtest success (${server.host}:${server.port}): ↓ ${downloadMbps.toFixed(2)} Mbps, ↑ ${uploadMbps.toFixed(2)} Mbps`);
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      log(`Speedtest attempt failed for ${server.host}:${server.port}: ${err?.message || err}`);
      attempts += 1;
    }
  }

  if (lastError) {
    state.downloadMbps = Number.NaN;
    state.uploadMbps = Number.NaN;
    state.status = 0;
    state.lastError = lastError?.message || String(lastError);
    log(`Speedtest failed across all servers: ${state.lastError}`);
  }

  const end = Date.now();
  state.lastRunEnd = end / 1000;
  state.lastDuration = (end - start) / 1000;
}

function renderMetrics() {
  const server = state.server || SERVER_POOL[activeServerIndex];
  const labels = `{server="${server.host}",port="${server.port}"}`;
  const download = formatNumber(state.downloadMbps, 3);
  const upload = formatNumber(state.uploadMbps, 3);
  const duration = formatNumber(state.lastDuration, 3);

  const lines = [
    '# HELP starlink_speedtest_download_mbps Latest iperf3 download throughput in Mbps',
    '# TYPE starlink_speedtest_download_mbps gauge',
    `starlink_speedtest_download_mbps${labels} ${Number.isFinite(download) ? download : 'nan'}`,
    '# HELP starlink_speedtest_upload_mbps Latest iperf3 upload throughput in Mbps',
    '# TYPE starlink_speedtest_upload_mbps gauge',
    `starlink_speedtest_upload_mbps${labels} ${Number.isFinite(upload) ? upload : 'nan'}`,
    '# HELP starlink_speedtest_last_success_timestamp_seconds Unix timestamp of the last successful speedtest',
    '# TYPE starlink_speedtest_last_success_timestamp_seconds gauge',
    `starlink_speedtest_last_success_timestamp_seconds${labels} ${state.lastSuccess ?? '0'}`,
    '# HELP starlink_speedtest_last_run_timestamp_seconds Unix timestamp of the most recent test attempt',
    '# TYPE starlink_speedtest_last_run_timestamp_seconds gauge',
    `starlink_speedtest_last_run_timestamp_seconds${labels} ${state.lastRunEnd ?? '0'}`,
    '# HELP starlink_speedtest_last_run_duration_seconds Duration in seconds of the most recent test attempt',
    '# TYPE starlink_speedtest_last_run_duration_seconds gauge',
    `starlink_speedtest_last_run_duration_seconds${labels} ${Number.isFinite(duration) ? duration : 'nan'}`,
    '# HELP starlink_speedtest_last_run_status Status of the most recent test (1=success, 0=failure)',
    '# TYPE starlink_speedtest_last_run_status gauge',
    `starlink_speedtest_last_run_status${labels} ${state.status}`,
    '# HELP starlink_speedtest_server_info Speedtest server metadata (always 1)',
    '# TYPE starlink_speedtest_server_info gauge',
    `starlink_speedtest_server_info${labels} 1`
  ];

  if (state.lastError) {
    lines.push(`# ERROR ${state.lastError.replace(/\n/g, ' ')}`);
  }

  return `${lines.join('\n')}\n`;
}

async function runLoop() {
  while (true) {
    await runTestCycle();
    await new Promise((resolve) => setTimeout(resolve, SPEEDTEST_INTERVAL_SECONDS * 1000));
  }
}

http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(renderMetrics());
    return;
  }

  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    const server = state.server || SERVER_POOL[activeServerIndex];
    res.end(JSON.stringify({ ok: true, server: server.host, port: server.port, interval: SPEEDTEST_INTERVAL_SECONDS, status: state.status }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Starlink speedtest exporter. Metrics available at /metrics.');
}).listen(SPEEDTEST_EXPORTER_PORT, '0.0.0.0', () => {
  const server = SERVER_POOL[activeServerIndex];
  log(`Speedtest exporter listening on port ${SPEEDTEST_EXPORTER_PORT}. Target ${server.host}:${server.port}. Interval ${SPEEDTEST_INTERVAL_SECONDS}s.`);
});

runLoop().catch((err) => {
  log(`Fatal error: ${err?.message || err}`);
  process.exitCode = 1;
});