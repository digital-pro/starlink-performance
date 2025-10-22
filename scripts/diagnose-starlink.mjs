#!/usr/bin/env node
import { URLSearchParams } from 'node:url';

async function q(endpoint, params) {
  const url = new URL(`http://127.0.0.1:9090/api/v1/${endpoint}`);
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

function latestScalar(vec) {
  if (!vec?.data?.result?.length) return null;
  const v = vec.data.result[0]?.value?.[1];
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

(async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 600;

    const [lat, loss, dMbps, uMbps, spike, microLoss, outage, obstruct] = await Promise.all([
      q('query', { query: 'starlink_latency_ms' }),
      q('query', { query: 'starlink_packet_loss_pct' }),
      q('query', { query: 'starlink_down_mbps' }),
      q('query', { query: 'starlink_up_mbps' }),
      q('query', { query: 'starlink_latency_spike' }),
      q('query', { query: 'starlink_micro_loss' }),
      q('query', { query: 'starlink_outage_active' }),
      q('query', { query: 'starlink_obstruction_present' })
    ]);

    const summary = {
      latencyMs: latestScalar(lat),
      packetLossPct: latestScalar(loss),
      downMbps: latestScalar(dMbps),
      upMbps: latestScalar(uMbps),
      flags: {
        latencySpike: latestScalar(spike) ? true : false,
        microLoss: latestScalar(microLoss) ? true : false,
        outageActive: latestScalar(outage) ? true : false,
        obstruction: latestScalar(obstruct) ? true : false
      }
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('diagnose failed:', e?.message || e);
    process.exitCode = 1;
  }
})();


