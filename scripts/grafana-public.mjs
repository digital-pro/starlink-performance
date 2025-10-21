#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

async function readToken() {
  if (process.env.GRAFANA_API_TOKEN && process.env.GRAFANA_API_TOKEN.trim()) return process.env.GRAFANA_API_TOKEN.trim();
  const t = await readFile('/home/djc/levante/levante-performance/secrets/grafana_api_token.txt', 'utf8');
  const token = t.trim();
  if (!token) throw new Error('grafana_api_token.txt is empty');
  return token;
}

async function main() {
  const uid = process.env.DASH_UID || 'f0e7a87e-0050-4223-9ac6-ee71140c822c';
  const host = process.env.STACK_HOST || 'levanteperformance.grafana.net';
  const token = await readToken();

  // Always rotate: delete existing then create a new one
  let res = await fetch(`https://${host}/api/dashboards/uid/${uid}/public-dashboards`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const pub of data) {
        if (pub?.uid) {
          await fetch(`https://${host}/api/dashboards/uid/${uid}/public-dashboards/${pub.uid}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }
    } else if (data && typeof data === 'object' && data.uid) {
      await fetch(`https://${host}/api/dashboards/uid/${uid}/public-dashboards/${data.uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  }

  // Create new public dashboard
  res = await fetch(`https://${host}/api/dashboards/uid/${uid}/public-dashboards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isEnabled: true })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`failed to create public dashboard: ${res.status} ${text}`);
  }
  const created = await res.json();
  console.log(`public_url=https://${host}/public-dashboards/${created.uid}`);
}

main().catch(err => { console.error(err?.message || err); process.exit(1); });


