#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

async function readToken() {
  if (process.env.GRAFANA_API_TOKEN && process.env.GRAFANA_API_TOKEN.trim()) return process.env.GRAFANA_API_TOKEN.trim();
  try {
    const t = await readFile('/home/djc/levante/levante-performance/secrets/grafana_api_token.txt', 'utf8');
    const token = t.trim();
    if (!token) throw new Error('grafana_api_token.txt is empty');
    return token;
  } catch (e) {
    throw new Error('Grafana API token not found. Set env GRAFANA_API_TOKEN or create secrets/grafana_api_token.txt');
  }
}

async function resolveStackHost() {
  if (process.env.STACK_HOST && process.env.STACK_HOST.trim()) return process.env.STACK_HOST.trim();
  // Attempt to parse from the Vue app link
  try {
    const app = await readFile('/home/djc/levante/levante-performance/apps/vue-dashboard/src/App.vue', 'utf8');
    const m = app.match(/https:\/\/([a-z0-9-]+\.grafana\.net)\//i);
    if (m && m[1]) return m[1];
  } catch {}
  throw new Error('STACK_HOST not provided and could not infer from App.vue. Set env STACK_HOST like levanteperformance.grafana.net');
}

async function main() {
  const token = await readToken();
  const host = await resolveStackHost();
  const jsonText = await readFile('/home/djc/levante/levante-performance/deployment/grafana-dashboard-starlink.json', 'utf8');
  const dashboard = JSON.parse(jsonText);
  const payload = { dashboard, overwrite: true, folderId: 0 };

  const url = `https://${host}/api/dashboards/db`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Grafana import failed: ${res.status} ${text}`);
  }
  console.log('Grafana dashboard import: OK');
  console.log(text);
}

main().catch(err => {
  console.error(err?.message || err);
  process.exit(1);
});


