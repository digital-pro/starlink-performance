<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Levante Performance</h1>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap; color:#667;">
        <small>Data Source: Prometheus (Grafana Cloud)</small>
        <a href="https://levanteperformance.grafana.net/d/ab8a8fa9-8d9c-47df-928b-9db5a89a5bca/starlink-performance-10-25?orgId=1&from=now-6h&to=now&timezone=browser&refresh=30s&showCategory=Panel%20options" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #444; background:#222; color:white; border-radius:8px; text-decoration:none;">Open in Grafana</a>
        <a href="https://levanteperformance.grafana.net/public-dashboards/ec38f814efb64ce6a2d1d4b7977cc83e?from=now-6h&to=now&timezone=browser" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #666; background:#444; color:white; border-radius:8px; text-decoration:none;">Public view</a>
      </div>
    </header>

    <section style="margin-top: 8px;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; color:#556; font-size: 13px;">
        <strong>Correlation (last 15m):</strong>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde;" title="Correlation coefficient between latency and packet drops over the last 15 minutes. Values closer to +1 or -1 indicate stronger correlation. Range: -1 to +1.">Latency↔Drops: {{ typeof corr.drops === 'number' ? corr.drops.toFixed(2) : 'N/A' }}</span>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde;" title="Correlation coefficient between latency and CPU usage over the last 15 minutes. Positive values suggest CPU load may be impacting network performance. Range: -1 to +1.">Latency↔CPU: {{ typeof corr.cpu === 'number' ? corr.cpu.toFixed(2) : 'N/A' }}</span>
        <span :style="periodicityStyle(corr.periodic)" title="Detects if latency shows a repeating pattern every ~15 seconds via autocorrelation analysis. YES (yellow) indicates periodic spikes, which may suggest scheduled processes, satellite beam switching, or regular interference. NO means variations appear random or follow a different pattern.">15s periodicity: {{ corr.periodic ? 'YES' : 'no' }}</span>
        <span style="margin-left:12px;">Range:</span>
        <select v-model="rangeSeconds" @change="refreshAll" style="padding:4px 8px; border-radius:6px; border:1px solid #ccd; background:white;">
          <option :value="600">Last 10 minutes</option>
          <option :value="3600">Last 1 hour</option>
          <option :value="10800">Last 3 hours</option>
          <option :value="21600">Last 6 hours</option>
          <option :value="43200">Last 12 hours</option>
        </select>
        <button @click="refreshAll" style="padding:6px 10px; border:1px solid #08c; background:#08c; color:white; border-radius:6px; cursor:pointer; font-size:12px;">Refresh</button>
        <span style="margin-left:16px; display:flex; align-items:center; gap:8px;">
          <label style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:12px;">Baseline Down:</span>
            <input v-model.number="baselineDownMbps" type="number" step="0.1" min="0" style="width:50px; padding:2px 4px; border:1px solid #ccd; border-radius:4px; text-align:right;" />
            <span style="font-size:11px; color:#778;">Mbps</span>
          </label>
          <label style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:12px;">Baseline Up:</span>
            <input v-model.number="baselineUpMbps" type="number" step="0.1" min="0" style="width:50px; padding:2px 4px; border:1px solid #ccd; border-radius:4px; text-align:right;" />
            <span style="font-size:11px; color:#778;">Mbps</span>
          </label>
        </span>
      </div>
    </section>


    <!-- Top metric cards removed per request -->

    <!-- Totals and Diagnostics in one row -->
    <section style="margin-top: 12px;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff;" title="Sum of downlink Mbps over last hour converted to GB (assumes 15s scrape interval)">
          <div style="font-size:12px; color:#778;">Total Download (last hour)</div>
          <div style="font-size:20px; font-weight:600;">{{ typeof totalDownGb === 'number' ? totalDownGb.toFixed(2) : 'N/A' }} GB</div>
        </div>
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff;" title="Windows WiFi adapter link speed (Mbps). This is the negotiated connection speed between your WiFi adapter and router, not your internet speed.">
          <div style="font-size:12px; color:#778;">WiFi Link Speed</div>
          <div style="font-size:20px; font-weight:600;">{{ format3(nicSpeedMbps) }} Mbps</div>
        </div>
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; grid-column: span 2;" title="Diagnostic flags derived from recording rules for common issues">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:13px;">Diagnostics</strong>
            <small style="color:#778; font-size:11px;">spike / micro-loss / outage / obstruction</small>
          </div>
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
            <div style="display:flex; align-items:center; justify-content:center;">
              <span :style="flagStyle(flags.latencySpike)" title="Latency spike: starlink_latency_spike > 0 indicates short-term spike vs baseline" style="font-size:11px; padding:4px 6px;">Spike</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:center;">
              <span :style="flagStyle(flags.microLoss)" title="Micro‑loss: sustained 1–2% packet loss typical on Starlink" style="font-size:11px; padding:4px 6px;">Micro‑loss</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:center;">
              <span :style="flagStyle(flags.outage)" title="Outage: starlink_outage_active > 0 when outage duration increases" style="font-size:11px; padding:4px 6px;">Outage</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:center;">
              <span :style="flagStyle(flags.obstruction)" title="Obstruction: obstruction indicator > 0.2 over 5m" style="font-size:11px; padding:4px 6px;">Obstruct</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section style="margin-top: 24px; display:grid; grid-template-columns: 1fr; gap: 16px;">

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bandwidth (Down / Up)</h3>
          <small style="color:#778;">starlink_down_mbps / starlink_up_mbps (recording rules)</small>
        </div>
        <div v-if="!hasBandwidthData" style="height:240px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No bandwidth data in selected window</div>
        <v-chart v-else ref="bandwidthChart" :option="bandwidthOption" autoresize style="height:240px; margin-top:8px;" @legendselectchanged="onBandwidthLegendChange" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;" title="Latency (ms) from starlink_latency_ms; packet loss (%) overlaid from starlink_packet_loss_pct">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <h3 style="margin:0;">Latency (last {{ rangeLabel }})</h3>
            <button @click="openLossDetails" style="padding:4px 8px; border:1px solid #08c; background:#08c; color:white; border-radius:6px; cursor:pointer; font-size:12px;" title="Opens a modal with current/avg/max loss stats across multiple windows">Packet loss details</button>
          </div>
          <small style="color:#778;">starlink_latency_ms (recording rule)</small>
        </div>
        <div v-if="!hasLatencyData" style="height:180px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No latency data in selected window</div>
        <v-chart v-else :option="latencyOption" autoresize style="height:180px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;" title="Anomaly detection rate and Starlink events overlay">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Anomaly Detection & Starlink Events</h3>
          <small style="color:#778;">netdata anomaly rate + state changes</small>
        </div>
        <div v-if="!hasAnomalyData && starlinkEvents.length === 0" style="height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No data in selected window</div>
        <v-chart v-else :option="anomalyOption" autoresize style="height:120px; margin-top:8px;" />
      </div>

      
    </section>

    <!-- Packet Loss Details Modal -->
    <div v-if="showLossDetails" style="position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999;">
      <div style="width: min(560px, 92%); background:white; border-radius:12px; border:1px solid #ddd; box-shadow:0 6px 24px rgba(0,0,0,0.2);">
        <div style="padding:12px 16px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;">
          <h3 style="margin:0;">Packet loss details</h3>
          <button @click="closeLossDetails" style="padding:4px 8px; border:1px solid #999; background:#f5f5f5; color:#333; border-radius:6px; cursor:pointer; font-size:12px;">Close</button>
        </div>
        <div style="padding:14px 16px; font-size:14px; color:#334;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="border:1px solid #eef; border-radius:8px; padding:10px;">
              <div style="color:#667; font-size:12px;">Current</div>
              <div style="font-size:18px; font-weight:600;">{{ formatPct(lossStats.current) }}%</div>
            </div>
            <div style="border:1px solid #eef; border-radius:8px; padding:10px;">
              <div style="color:#667; font-size:12px;">Time with loss > 0% (15m)</div>
              <div style="font-size:18px; font-weight:600;">{{ formatPct(lossStats.timeWithLossPct15m) }}%</div>
            </div>
            <div style="border:1px solid #eef; border-radius:8px; padding:10px;">
              <div style="color:#667; font-size:12px;">Max / Avg (5m)</div>
              <div style="font-size:18px; font-weight:600;">{{ formatPct(lossStats.max5m) }}% / {{ formatPct(lossStats.avg5m) }}%</div>
            </div>
            <div style="border:1px solid #eef; border-radius:8px; padding:10px;">
              <div style="color:#667; font-size:12px;">Max / Avg (15m)</div>
              <div style="font-size:18px; font-weight:600;">{{ formatPct(lossStats.max15m) }}% / {{ formatPct(lossStats.avg15m) }}%</div>
            </div>
            <div style="border:1px solid #eef; border-radius:8px; padding:10px;">
              <div style="color:#667; font-size:12px;">Max / Avg (1h)</div>
              <div style="font-size:18px; font-weight:600;">{{ formatPct(lossStats.max1h) }}% / {{ formatPct(lossStats.avg1h) }}%</div>
            </div>
          </div>
          <div style="margin-top:10px; color:#667; font-size:12px;">Note: Percentages are computed from `starlink_packet_loss_pct` recording rule.</div>
        </div>
      </div>
    </div>

    <footer style="margin-top: 24px; color:#667;">
      <small>
        Prometheus via <code>/api/promql</code>. Ensure `PROM_URL` and auth are set in Vercel. This is a starter UI; extend with alerts, gauges, and trend comparisons.
      </small>
    </footer>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent]);

const metrics = ref<Record<string, number | string>>({
  latency: 'N/A',
  packetLoss: 'N/A',
  bandwidthDown: 'N/A',
  bandwidthUp: 'N/A',
  anomalyRate: 'N/A'
});

const flags = ref<{ latencySpike: boolean; microLoss: boolean; outage: boolean; obstruction: boolean }>({
  latencySpike: false,
  microLoss: false,
  outage: false,
  obstruction: false
});

const corr = ref<{ drops: number | 'N/A'; cpu: number | 'N/A'; ac15: number | 'N/A'; periodic: boolean }>({ drops: 'N/A', cpu: 'N/A', ac15: 'N/A', periodic: false });

const totalDownGb = ref<number | 'N/A'>('N/A');
const nicSpeedMbps = ref<number | 'N/A'>('N/A');
// bucket info removed
// Initialize rangeSeconds from localStorage, default to 1 hour
const storedRange = localStorage.getItem('levante_rangeSeconds');
const rangeSeconds = ref<number>(storedRange ? Number(storedRange) : 3600);

// Baseline traffic (Mbps) to subtract from benchmark calculations
const baselineDownMbps = ref<number>(0.3);
const baselineUpMbps = ref<number>(0.3);
const rangeLabel = computed(() => (
  rangeSeconds.value === 600 ? '10 min' :
  rangeSeconds.value === 3600 ? '1 hour' :
  rangeSeconds.value === 10800 ? '3 hours' :
  rangeSeconds.value === 21600 ? '6 hours' :
  rangeSeconds.value === 43200 ? '12 hours' : `${Math.round(rangeSeconds.value/3600)} hours`
));
const showLossDetails = ref(false);
const lossStats = ref({
  current: 'N/A' as number | 'N/A',
  avg5m: 'N/A' as number | 'N/A',
  max5m: 'N/A' as number | 'N/A',
  avg15m: 'N/A' as number | 'N/A',
  max15m: 'N/A' as number | 'N/A',
  avg1h: 'N/A' as number | 'N/A',
  max1h: 'N/A' as number | 'N/A',
  timeWithLossPct15m: 'N/A' as number | 'N/A'
});

// Desired order: Down (upper-left), Latency (upper-right), Up (lower-left), Packet Loss (lower-right)
const metricCards = [
  { key: 'bandwidthDown', title: 'Down (Mbps)' },
  { key: 'latency', title: 'Latency (ms)' },
  { key: 'bandwidthUp', title: 'Up (Mbps)' },
  { key: 'packetLoss', title: 'Packet Loss (%)' },
  { key: 'anomalyRate', title: 'Anomaly Rate (%)' }
] as const;

function format3(value: number | string): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(3);
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n.toFixed(3);
  }
  return value;
}

function formatPct(v: number | 'N/A') {
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  return 'N/A';
}

async function fetchInstantProm(query: string): Promise<number | 'N/A'> {
  try {
    const res = await axios.get(`/api/promql`, { params: { query } });
    const result = res.data?.data?.result;
    if (Array.isArray(result) && result.length > 0) {
      const value = result[0]?.value?.[1];
      const num = Number(value);
      return Number.isFinite(num) ? num : 'N/A';
    }
    return 'N/A';
  } catch {
    return 'N/A';
  }
}

async function fetchRangeProm(query: string, seconds = 600, step = 10, fixedEnd?: number): Promise<Array<[number, number]>> {
  try {
    const end = typeof fixedEnd === 'number' ? fixedEnd : Math.floor(Date.now() / 1000);
    const start = end - seconds;
    const res = await axios.get(`/api/promql`, { params: { query, start, end, step } });
    const result = res.data?.data?.result;
    if (!Array.isArray(result) || result.length === 0) return [];
    const values = result[0]?.values as Array<[number, string]> | undefined;
    if (!values) return [];
    const mapped = values.map(([ts, v]) => [Number(ts) * 1000, Number(v)] as [number, number]);
    return mapped.filter(([, v]) => Number.isFinite(v));
  } catch {
    return [];
  }
}

async function computeRunMb(run: { start: number; end: number }) {
  const durationMs = Math.max(0, (run.end || 0) - (run.start || 0));
  if (durationMs <= 0) return { mbDown: 0, mbUp: 0 };
  const seconds = Math.ceil(durationMs / 1000);
  const step = 30; // seconds
  const endSec = Math.floor(run.end / 1000);
  
  // Query returns bytes/sec, we'll integrate over time to get total bytes
  // 
  // ⚠️ CRITICAL: DO NOT SWAP THESE METRICS! ⚠️
  // Starlink uses DISH perspective (opposite of user perspective):
  //   - starlink_dish_downlink_throughput_bytes = satellite→dish = USER DOWNLOAD
  //   - starlink_dish_uplink_throughput_bytes = dish→satellite = USER UPLOAD
  // This has been incorrectly swapped multiple times. The mapping below is CORRECT.
  const [downSeries, upSeries] = await Promise.all([
    fetchRangeProm('starlink_dish_downlink_throughput_bytes', seconds, step, endSec),  // USER DOWNLOAD (satellite→dish)
    fetchRangeProm('starlink_dish_uplink_throughput_bytes', seconds, step, endSec),    // USER UPLOAD (dish→satellite)
  ]);
  
  // Integrate: sum(bytes/sec * step_seconds) / 1e6 = total MB
  const sumBytes = (series: Array<[number, number]>) => 
    series.reduce((acc, [, bytesPerSec]) => acc + (Number(bytesPerSec) * step), 0) / 1e6;
  
  // Sanity check: Compare integration with simple start/end difference
  const getStartEndDiff = (series: Array<[number, number]>) => {
    if (series.length < 2) return 0;
    const first = series[0][1];
    const last = series[series.length - 1][1];
    // Average throughput * duration
    return ((first + last) / 2) * seconds / 1e6;
  };
  
  const integratedDown = sumBytes(downSeries);
  const integratedUp = sumBytes(upSeries);
  const startEndDown = getStartEndDiff(downSeries);
  const startEndUp = getStartEndDiff(upSeries);
  
  // If integration differs from start/end by >30%, use start/end method
  const downDiffPct = Math.abs(integratedDown - startEndDown) / Math.max(integratedDown, startEndDown, 1);
  const upDiffPct = Math.abs(integratedUp - startEndUp) / Math.max(integratedUp, startEndUp, 1);
  
  let rawDown = integratedDown;
  let rawUp = integratedUp;
  
  if (downDiffPct > 0.3) {
    console.warn(`⚠️ Download sanity check failed: integrated=${integratedDown.toFixed(1)}MB vs start/end=${startEndDown.toFixed(1)}MB (${(downDiffPct*100).toFixed(0)}% diff) - using start/end`);
    rawDown = startEndDown;
  }
  if (upDiffPct > 0.3) {
    console.warn(`⚠️ Upload sanity check failed: integrated=${integratedUp.toFixed(1)}MB vs start/end=${startEndUp.toFixed(1)}MB (${(upDiffPct*100).toFixed(0)}% diff) - using start/end`);
    rawUp = startEndUp;
  }
  
  // Subtract baseline traffic (baseline is in Mbps, convert to MB over duration)
  const baselineMbDown = (baselineDownMbps.value * seconds) / 8; // Mbps * seconds / 8 = MB
  const baselineMbUp = (baselineUpMbps.value * seconds) / 8;
  
  const mbDown = Math.max(0, Number((rawDown - baselineMbDown).toFixed(2)));
  const mbUp = Math.max(0, Number((rawUp - baselineMbUp).toFixed(2)));
  
  console.log(`📊 MB calc for ${seconds}s: Down ${rawDown.toFixed(2)}MB - ${baselineMbDown.toFixed(2)}MB baseline = ${mbDown}MB | Up ${rawUp.toFixed(2)}MB - ${baselineMbUp.toFixed(2)}MB baseline = ${mbUp}MB`);
  
  return { mbDown, mbUp };
}

async function enrichVisibleRunsWithMb() {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  const visible = benchRuns.value.filter(r => r.end >= windowStart && r.start <= now);
  await Promise.all(visible.map(async (r) => {
    if (typeof (r as any).mbDown === 'number' && typeof (r as any).mbUp === 'number') return;
    try {
      const { mbDown, mbUp } = await computeRunMb(r);
      (r as any).mbDown = mbDown;
      (r as any).mbUp = mbUp;
    } catch {}
  }));
  // nudge reactivity
  benchRuns.value = benchRuns.value.slice();
}

// Fetch latest benchmark runs for overlay mark lines
async function loadBenchRuns() {
  try {
    const r = await axios.get('/api/bench-runs', { params: { t: Date.now() } });
    const arr = Array.isArray(r.data?.runs) ? r.data.runs : [];
    // Normalize to ms epoch; some sources may provide seconds
    const normalized = arr.map((run: any) => {
      let s = Number(run.start);
      let e = Number(run.end);
      if (Number.isFinite(s) && s < 1e12) s = s * 1000; // seconds → ms
      if (Number.isFinite(e) && e < 1e12) e = e * 1000;
      const mbDown = typeof run.mbDown === 'number' ? run.mbDown : undefined;
      const mbUp = typeof run.mbUp === 'number' ? run.mbUp : undefined;
      return { task: String(run.task || 'run'), start: s, end: e, mbDown, mbUp };
    }).filter((x: any) => Number.isFinite(x.start) && Number.isFinite(x.end));
    // Deduplicate and sort by start
    const seen = new Set<string>();
    const uniq = normalized.filter((x: any) => {
      const key = `${x.task}:${x.start}:${x.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a: any, b: any) => a.start - b.start);
    benchRuns.value = uniq;

    // Debug: print PT time for each mark line and whether it's in current range
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles', year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const now = Date.now();
      const startWindow = now - (rangeSeconds.value * 1000);
      const startPT = fmt.format(new Date(startWindow));
      const endPT = fmt.format(new Date(now));
      console.groupCollapsed(`📊 Benchmark runs (${uniq.length})`);
      console.log(`🕘 X-axis PT window: start=${startPT}, end=${endPT}`);
      for (const run of uniq) {
        const sPT = fmt.format(new Date(run.start));
        const ePT = fmt.format(new Date(run.end));
        const inWindow = run.end >= startWindow && run.start <= now;
        const icon = inWindow ? '🟢' : '🔴';
        console.log(`${icon} ${run.task}: start=${run.start}ms (${sPT} PT), end=${run.end}ms (${ePT} PT), inWindow=${inWindow}`);
      }
      console.groupEnd();
    } catch {}

    // Compute MB for visible runs (non-blocking)
    enrichVisibleRunsWithMb();
  } catch {
    benchRuns.value = [];
  }
}

async function refreshAll() {
  // Fetch benchmark runs for vertical line markers
  try {
    const runsRes = await axios.get('/api/bench-runs');
    console.log('📊 Benchmark runs response:', runsRes.data);
    if (runsRes.data?.ok && Array.isArray(runsRes.data.runs)) {
      benchRuns.value = runsRes.data.runs;
      console.log(`✅ Loaded ${benchRuns.value.length} benchmark runs:`, benchRuns.value);
      // Enrich visible runs with MB calculations
      await enrichVisibleRunsWithMb();
    }
  } catch (e) {
    console.error('❌ Could not fetch benchmark runs:', e);
  }

  const q = {
    latency: 'starlink_latency_ms',
    packetLoss: 'starlink_packet_loss_pct',
    bandwidthDown: 'starlink_down_mbps',
    bandwidthUp: 'starlink_up_mbps'
  } as const;

  const [lat, pl, dMbps, uMbps] = await Promise.all([
    fetchInstantProm(q.latency),
    fetchInstantProm(q.packetLoss),
    fetchInstantProm(q.bandwidthDown),
    fetchInstantProm(q.bandwidthUp)
  ]);
  metrics.value.latency = lat;
  metrics.value.packetLoss = pl;
  metrics.value.bandwidthDown = dMbps;
  metrics.value.bandwidthUp = uMbps;

  // Total download (GB) over last hour; assumes 15s scrape interval
  const totalGb = await fetchInstantProm('sum_over_time(starlink_down_mbps[1h]) * 15 / 8000');
  totalDownGb.value = typeof totalGb === 'number' && Number.isFinite(totalGb) ? totalGb : 'N/A';

  // WiFi link speed (Mbps): windows_wifi_link_speed_mbps
  const wifi = await fetchInstantProm('windows_wifi_link_speed_mbps');
  nicSpeedMbps.value = typeof wifi === 'number' && Number.isFinite(wifi) ? wifi : 'N/A';

  const fixedEnd = Math.floor(Date.now() / 1000);
  const seconds = rangeSeconds.value;
  const step = Math.max(10, Math.floor(seconds / 60));
  latencySeries.value = await fetchRangeProm(q.latency, seconds, step, fixedEnd);
  packetLossSeries.value = await fetchRangeProm(q.packetLoss, seconds, step, fixedEnd);
  const [down, up, ml, downMBm, upMBm, downMB10, upMB10] = await Promise.all([
    fetchRangeProm(q.bandwidthDown, seconds, step, fixedEnd),
    fetchRangeProm(q.bandwidthUp, seconds, step, fixedEnd),
    fetchRangeProm('starlink_micro_loss * 100', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_downlink_throughput_bytes[1m]) * 60 / 1e6', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_uplink_throughput_bytes[1m]) * 60 / 1e6', seconds, step, fixedEnd),
    fetchRangeProm('sum_over_time(starlink_dish_downlink_throughput_bytes[10m]) / 1e6', seconds, step, fixedEnd),
    fetchRangeProm('sum_over_time(starlink_dish_uplink_throughput_bytes[10m]) / 1e6', seconds, step, fixedEnd)
  ]);
  bandwidthDownSeries.value = down;
  bandwidthUpSeries.value = up;
  microLossSeries.value = ml;
  downMbPerMinSeries.value = downMBm;
  upMbPerMinSeries.value = upMBm;
  downMbPer10MinSeries.value = downMB10;
  upMbPer10MinSeries.value = upMB10;

  // Anomaly detection
  anomalySeries.value = await fetchRangeProm('netdata_anomaly_detection_anomaly_rate_percentage_average', seconds, step, fixedEnd);
  console.log(`📊 Anomaly series: ${anomalySeries.value.length} data points`);

  // Flags
  const [spike, microLoss, outage, obstruction] = await Promise.all([
    fetchInstantProm('starlink_latency_spike'),
    fetchInstantProm('starlink_micro_loss'),
    fetchInstantProm('starlink_outage_active'),
    fetchInstantProm('starlink_obstruction_present')
  ]);
  flags.value.latencySpike = spike === 'N/A' ? false : Number(spike) > 0;
  flags.value.microLoss = microLoss === 'N/A' ? false : Number(microLoss) > 0;
  flags.value.outage = outage === 'N/A' ? false : Number(outage) > 0;
  flags.value.obstruction = obstruction === 'N/A' ? false : Number(obstruction) > 0;

  // AI correlation (latency vs CPU/drops; 15s periodicity)
  try {
    const r = await axios.get('/api/ai-correlate', { params: { seconds: 900, step: 10 } });
    const c = (r.data && r.data.corr) ? r.data.corr : {} as any;
    const p = (r.data && r.data.periodicity) ? r.data.periodicity : {} as any;
    const toNum = (x: any) => (typeof x === 'number' && Number.isFinite(x) ? x : 'N/A');
    corr.value.drops = toNum(c.latency_vs_drops);
    corr.value.cpu = toNum(c.latency_vs_cpu);
    corr.value.ac15 = toNum(p.ac_15s);
    corr.value.periodic = Boolean(p.detected);
  } catch {
    corr.value = { drops: 'N/A', cpu: 'N/A', ac15: 'N/A', periodic: false };
  }

  // Starlink Events: detect state changes and obstructions
  await loadStarlinkEvents(seconds, step, fixedEnd);
}

async function loadStarlinkEvents(seconds: number, step: number, fixedEnd: number) {
  const events: Array<{ time: string; timestamp: number; message: string; icon: string; color: string }> = [];
  
  try {
    // Fetch metrics for smart event detection
    const [downThroughput, upThroughput, obstructionFraction, packetLoss, latency] = await Promise.all([
      fetchRangeProm('starlink_dish_uplink_throughput_bytes', seconds, step, fixedEnd),      // User download
      fetchRangeProm('starlink_dish_downlink_throughput_bytes', seconds, step, fixedEnd),    // User upload
      fetchRangeProm('starlink_dish_fraction_obstruction_ratio', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_pop_ping_drop_ratio', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_pop_ping_latency_seconds', seconds, step, fixedEnd)
    ]);
    
    let inSkySearch = false;
    let inObstruction = false;
    let inNetworkIssue = false;
    let skySearchStart = 0;
    let obstructionStart = 0;
    let networkIssueStart = 0;
    
    const formatTime = (ts: number) => new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date(ts));
    
    console.log(`📊 Analyzing ${downThroughput.length} samples for events...`);
    
    let minObsFrac = 1, maxObsFrac = 0, maxLoss = 0, maxLat = 0;
    
    // Calculate rolling baseline for obstruction (average over last 5 minutes)
    const baselineWindow = 10; // samples (~5 minutes with 30s step)
    const obstructionBaseline: number[] = [];
    
    for (let i = 0; i < downThroughput.length; i++) {
      const ts = downThroughput[i][0];
      const downBps = downThroughput[i][1];
      const upBps = upThroughput[i]?.[1] || 0;
      const obsFrac = obstructionFraction[i]?.[1] || 0;
      const loss = packetLoss[i]?.[1] || 0;
      const lat = (latency[i]?.[1] || 0) * 1000; // Convert to ms
      
      minObsFrac = Math.min(minObsFrac, obsFrac);
      maxObsFrac = Math.max(maxObsFrac, obsFrac);
      maxLoss = Math.max(maxLoss, loss);
      maxLat = Math.max(maxLat, lat);
      
      // Sky Search: Both throughputs drop to near-zero (< 10000 bytes/sec = ~80 Kbps)
      const isSkySearching = downBps < 10000 && upBps < 10000;
      if (isSkySearching && !inSkySearch) {
        inSkySearch = true;
        skySearchStart = ts;
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: 'Sky search started',
          icon: '🔍',
          color: '#f90'
        });
      } else if (!isSkySearching && inSkySearch) {
        inSkySearch = false;
        const durationSec = Math.round((ts - skySearchStart) / 1000);
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: `Connected (searched ${durationSec}s)`,
          icon: '✅',
          color: '#0a7'
        });
      }
      
      // Obstruction: Any measurable obstruction (> 0.005 = 0.5%)
      const isObstructed = obsFrac > 0.005;
      if (isObstructed && !inObstruction && !inSkySearch) {
        inObstruction = true;
        obstructionStart = ts;
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: `Obstruction detected (${(obsFrac * 100).toFixed(1)}%)`,
          icon: '🚫',
          color: '#c33'
        });
      } else if (!isObstructed && inObstruction) {
        inObstruction = false;
        const durationSec = Math.round((ts - obstructionStart) / 1000);
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: `Obstruction cleared (${durationSec}s)`,
          icon: '✓',
          color: '#0a7'
        });
      }
      
      // Network Issue: Elevated packet loss (> 1%) or high latency (> 60ms) with good throughput
      const hasNetworkIssue = (loss > 0.01 || lat > 60) && downBps > 10000 && !inSkySearch;
      if (hasNetworkIssue && !inNetworkIssue && !inObstruction) {
        inNetworkIssue = true;
        networkIssueStart = ts;
        const reason = loss > 0.01 ? `${(loss * 100).toFixed(1)}% loss` : `${lat.toFixed(0)}ms latency`;
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: `Network degradation (${reason})`,
          icon: '⚠️',
          color: '#f60'
        });
      } else if (!hasNetworkIssue && inNetworkIssue) {
        inNetworkIssue = false;
        const durationSec = Math.round((ts - networkIssueStart) / 1000);
        events.push({
          time: formatTime(ts),
          timestamp: ts,
          message: `Network recovered (${durationSec}s)`,
          icon: '✓',
          color: '#0a7'
        });
      }
      
      // Calculate rolling baseline for obstruction
      obstructionBaseline.push(obsFrac);
      if (obstructionBaseline.length > baselineWindow) {
        obstructionBaseline.shift();
      }
      
      // Detect significant changes from baseline (after we have enough samples)
      // Check every 20 samples (20 × 30s = 10 minutes)
      if (i > baselineWindow && i % 20 === 0) {
        const avgBaseline = obstructionBaseline.reduce((a, b) => a + b, 0) / obstructionBaseline.length;
        
        // Spike detection: Current obstruction is 1.5x baseline or +1.5% absolute increase
        if (obsFrac > avgBaseline * 1.5 && obsFrac > 0.015) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `Obstruction spike ${(obsFrac*100).toFixed(1)}% (baseline ${(avgBaseline*100).toFixed(1)}%)`,
            icon: '🔴',
            color: '#c33'
          });
        } else if (obsFrac > avgBaseline + 0.015) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `Obstruction increased ${(obsFrac*100).toFixed(1)}%`,
            icon: '🟠',
            color: '#f60'
          });
        }
        
        // High packet loss (above 3%)
        if (loss > 0.03) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `High packet loss ${(loss*100).toFixed(1)}%`,
            icon: '⚠️',
            color: '#f90'
          });
        }
      }
      
      // Periodic sampling: Report issues at regular intervals (every ~5 minutes)
      if (sampleInterval > 0 && i % sampleInterval === 0 && i > 0) {
        if (obsFrac > 0.01) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `Obstruction ${(obsFrac*100).toFixed(1)}%`,
            icon: '🔴',
            color: '#f60'
          });
        } else if (loss > 0.02) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `Packet loss ${(loss*100).toFixed(1)}%`,
            icon: '⚠️',
            color: '#f90'
          });
        } else if (lat > 50) {
          events.push({
            time: formatTime(ts),
            timestamp: ts,
            message: `High latency ${lat.toFixed(0)}ms`,
            icon: '🐌',
            color: '#fa0'
          });
        }
      }
    }
    
    // Add marker for persistent conditions at start of window if detected
    if (downThroughput.length > 0 && maxObsFrac > 0.05) {
      // Place event 1 minute into the window to ensure it's visible
      const firstTs = downThroughput[0][0] + 60000;
      const avgObsFrac = (minObsFrac + maxObsFrac) / 2;
      events.push({
        time: formatTime(firstTs),
        timestamp: firstTs,
        message: `Persistent obstruction (${(avgObsFrac*100).toFixed(1)}% avg)`,
        icon: '🚫',
        color: '#c33'
      });
    }
    
    // Sort by time (newest first) and limit to last 20
    events.sort((a, b) => {
      const aTime = new Date(a.time).getTime();
      const bTime = new Date(b.time).getTime();
      return bTime - aTime;
    });
    starlinkEvents.value = events.slice(0, 20);
    
    console.log(`📡 Detected ${events.length} Starlink events in last ${Math.round(seconds/60)}min`);
    console.log(`📊 Metrics summary: Obstruction ${(minObsFrac*100).toFixed(1)}%-${(maxObsFrac*100).toFixed(1)}%, Max loss ${(maxLoss*100).toFixed(1)}%, Max latency ${maxLat.toFixed(0)}ms`);
    
    // Report persistent conditions
    if (maxObsFrac > 0.05 && events.length === 0) {
      console.warn(`⚠️ Persistent obstruction detected (${(maxObsFrac*100).toFixed(1)}%) but no state changes - obstruction has been constant`);
    }
  } catch (e) {
    console.error('Error loading Starlink events:', e);
    starlinkEvents.value = [];
  }
}

async function computeLossStats() {
  const [current, avg5m, max5m, avg15m, max15m, avg1h, max1h, timeWithLoss] = await Promise.all([
    fetchInstantProm('starlink_packet_loss_pct'),
    fetchInstantProm('avg_over_time(starlink_packet_loss_pct[5m])'),
    fetchInstantProm('max_over_time(starlink_packet_loss_pct[5m])'),
    fetchInstantProm('avg_over_time(starlink_packet_loss_pct[15m])'),
    fetchInstantProm('max_over_time(starlink_packet_loss_pct[15m])'),
    fetchInstantProm('avg_over_time(starlink_packet_loss_pct[1h])'),
    fetchInstantProm('max_over_time(starlink_packet_loss_pct[1h])'),
    fetchInstantProm('100 * sum_over_time((starlink_packet_loss_pct > 0)[15m:15s]) / (15m/15s)')
  ]);
  lossStats.value.current = current;
  lossStats.value.avg5m = avg5m;
  lossStats.value.max5m = max5m;
  lossStats.value.avg15m = avg15m;
  lossStats.value.max15m = max15m;
  lossStats.value.avg1h = avg1h;
  lossStats.value.max1h = max1h;
  lossStats.value.timeWithLossPct15m = timeWithLoss;
}

function openLossDetails() {
  showLossDetails.value = true;
  computeLossStats();
}

function closeLossDetails() {
  showLossDetails.value = false;
}

const latencySeries = ref<Array<[number, number]>>([]);
const bandwidthDownSeries = ref<Array<[number, number]>>([]);
const bandwidthUpSeries = ref<Array<[number, number]>>([]);
const benchmarkRuns = ref<Array<{ task: string; start: number; end: number }>>([]);
const microLossSeries = ref<Array<[number, number]>>([]);
const packetLossSeries = ref<Array<[number, number]>>([]);
const downMbPerMinSeries = ref<Array<[number, number]>>([]);
const upMbPerMinSeries = ref<Array<[number, number]>>([]);
const downMbPer10MinSeries = ref<Array<[number, number]>>([]);
const upMbPer10MinSeries = ref<Array<[number, number]>>([]);
const benchRuns = ref<Array<{ task: string; start: number; end: number }>>([]);
const anomalySeries = ref<Array<[number, number]>>([]);
const starlinkEvents = ref<Array<{ time: string; timestamp: number; message: string; icon: string; color: string }>>([]);


const hasLatencyData = computed(() => latencySeries.value.length > 0 || packetLossSeries.value.length > 0);
const hasBandwidthData = computed(() => bandwidthDownSeries.value.length > 0 || bandwidthUpSeries.value.length > 0 || microLossSeries.value.length > 0 || downMbPerMinSeries.value.length > 0 || upMbPerMinSeries.value.length > 0 || downMbPer10MinSeries.value.length > 0 || upMbPer10MinSeries.value.length > 0);
const hasAnomalyData = computed(() => anomalySeries.value.length > 0);

const latencyOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  const markLineData: any[] = benchRuns.value
    .filter(run => run.end >= windowStart && run.start <= now)
    .flatMap(run => {
      const dMb = typeof (run as any).mbDown === 'number' ? Math.trunc((run as any).mbDown) : undefined;
      const uMb = typeof (run as any).mbUp === 'number' ? Math.trunc((run as any).mbUp) : undefined;
      const startItem: any = { name: `${run.task} ▶\n${new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(run.start))}\n↓${dMb ?? '?'}MB ↑${uMb ?? '?'}MB`, xAxis: run.start, lineStyle: { color: '#0a7', width: 2 }, task: run.task, mbDown: dMb, mbUp: uMb, label: { show: false } };
      const endItem: any = { 
        name: `${run.task} ◼\n${new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(run.start))} - ${new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(run.end))}\n↓${dMb ?? '?'}MB ↑${uMb ?? '?'}MB`, 
        xAxis: run.end, 
        lineStyle: { color: '#b30000', width: 2 }, 
        task: run.task, 
        mbDown: dMb, 
        mbUp: uMb, 
        label: { 
          show: true, 
          formatter: (p: any) => {
            const t = p?.data?.task || '';
            const d = typeof p?.data?.mbDown === 'number' ? p.data.mbDown : undefined;
            const u = typeof p?.data?.mbUp === 'number' ? p.data.mbUp : undefined;
            const line2 = (typeof d === 'number' || typeof u === 'number') ? `↓${d ?? '?'}MB ↑${u ?? '?'}MB` : '';
            return line2 ? `${t}\n${line2}` : t;
          }, 
          lineHeight: 14 
        } 
      };
      return [startItem, endItem];
    });
  // Add reference line at now-5m
  markLineData.unshift({ name: 'T-5m', xAxis: now - 5*60*1000, lineStyle: { color: '#1273EB', width: 4 } } as any);

  console.log('📈 Latency markLine data:', { 
    benchRunsCount: benchRuns.value.length, 
    markLineData,
    benchRuns: benchRuns.value 
  });

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 80, top: 64, bottom: 40 },
    legend: { top: 6, data: ['Latency', 'Packet Loss (%)'] },
    xAxis: { 
    type: 'time',
    axisLabel: {
      formatter: (value: number) => new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(value))
    }
  },
    yAxis: [
      { type: 'value', name: 'ms' },
      { type: 'value', name: '%', position: 'right' }
    ],
    series: [
      { 
        type: 'line', 
        name: 'Latency', 
        data: latencySeries.value, 
        showSymbol: false, 
        smooth: true, 
        lineStyle: { width: 2 }, 
        yAxisIndex: 0
      },
      { type: 'line', name: 'Packet Loss (%)', data: packetLossSeries?.value || [], showSymbol: false, lineStyle: { width: 2, type: 'dashed' }, yAxisIndex: 1 },
      // Invisible series to force markLine rendering
      {
        type: 'line', name: 'Benchmarks', data: [], showSymbol: false, xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { width: 0, opacity: 0 },
        markLine: markLineData.length > 0 ? {
          symbol: ['none','none'],
          label: { show: true, formatter: (p: any) => (p?.name || ''), fontSize: 10 },
          tooltip: { show: true, formatter: (p: any) => {
            const t = p?.data?.task || p?.name || '';
            const dMb = typeof p?.data?.mbDown === 'number' ? Math.trunc(p.data.mbDown) : undefined;
            const uMb = typeof p?.data?.mbUp === 'number' ? Math.trunc(p.data.mbUp) : undefined;
            const line1 = dMb !== undefined ? `↓${dMb}MB` : '';
            const line2 = uMb !== undefined ? `↑${uMb}MB` : '';
            return `${t}${(line1||line2) ? `\n${line1} ${line2}` : ''}`;
          } },
          data: markLineData,
          emphasis: { lineStyle: { width: 2 } },
          silent: true
        } : undefined
      }
    ]
  };
});

const bandwidthOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  const markLineData: any[] = benchRuns.value
    .filter(run => run.end >= windowStart && run.start <= now)
    .flatMap(run => {
      const dMb = typeof (run as any).mbDown === 'number' ? Math.trunc((run as any).mbDown) : undefined;
      const uMb = typeof (run as any).mbUp === 'number' ? Math.trunc((run as any).mbUp) : undefined;
      const formatTime = (ts: number) => new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(ts));
      const startItem: any = { name: `${run.task} ▶\n${formatTime(run.start)}\n↓${dMb ?? '?'}MB ↑${uMb ?? '?'}MB`, xAxis: run.start, lineStyle: { color: '#0a7', width: 2 }, task: run.task, mbDown: dMb, mbUp: uMb, label: { show: false } };
      const endItem: any = { 
        name: `${run.task} ◼\n${formatTime(run.start)} - ${formatTime(run.end)}\n↓${dMb ?? '?'}MB ↑${uMb ?? '?'}MB`, 
        xAxis: run.end, 
        lineStyle: { color: '#b30000', width: 2 }, 
        task: run.task, 
        mbDown: dMb, 
        mbUp: uMb, 
        label: { 
          show: true, 
          formatter: (p: any) => {
            const t = p?.data?.task || '';
            const d = typeof p?.data?.mbDown === 'number' ? p.data.mbDown : undefined;
            const u = typeof p?.data?.mbUp === 'number' ? p.data.mbUp : undefined;
            const line2 = (typeof d === 'number' || typeof u === 'number') ? `↓${d ?? '?'}MB ↑${u ?? '?'}MB` : '';
            return line2 ? `${t}\n${line2}` : t;
          }, 
          lineHeight: 14 
        } 
      };
      return [startItem, endItem];
    });

  // Restore legend selection from localStorage
  const storedLegend = localStorage.getItem('levante_bandwidthLegend');
  const legendSelected = storedLegend ? JSON.parse(storedLegend) : undefined;

  return ({
    tooltip: { 
      trigger: 'none'  // Disable automatic tooltip, let mark lines handle their own
    },
    grid: { left: 60, right: 100, top: 64, bottom: 40 },
    legend: { 
      top: 6, 
      data: ['Down (Mbps)', 'Up (Mbps)', 'Down (MB/min)', 'Up (MB/min)', 'Down (MB/10m)', 'Up (MB/10m)', 'Micro-loss (%/10)'],
      selected: legendSelected
    },
    xAxis: { 
      type: 'time',
      axisLabel: {
        formatter: (value: number) => new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(value))
      }
    },
    yAxis: [
      { type: 'value', name: 'Mbps' },
      { type: 'value', name: 'MB/min', position: 'right', offset: 0 },
      { type: 'value', name: '%', position: 'right', offset: 48 }
    ],
    series: [
      { 
        type: 'line', 
        name: 'Down (Mbps)', 
        data: bandwidthDownSeries.value, 
        showSymbol: false, 
        smooth: true, 
        yAxisIndex: 0, 
        lineStyle: { width: 2 }
      },
      { type: 'line', name: 'Up (Mbps)', data: bandwidthUpSeries.value, showSymbol: false, smooth: true, yAxisIndex: 0, lineStyle: { width: 2 } },
      { type: 'line', name: 'Down (MB/min)', data: downMbPerMinSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.5, type: 'dotted' } },
      { type: 'line', name: 'Up (MB/min)', data: upMbPerMinSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.5, type: 'dotted' } },
      { type: 'line', name: 'Down (MB/10m)', data: downMbPer10MinSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.5 } },
      { type: 'line', name: 'Up (MB/10m)', data: upMbPer10MinSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.5 } },
      { type: 'line', name: 'Micro-loss (%/10)', data: microLossSeries.value, showSymbol: false, yAxisIndex: 2, lineStyle: { type: 'dashed', width: 2 } },
      // Invisible series to force markLine rendering (always present)
      {
        type: 'line', name: 'Benchmarks', data: [], showSymbol: false, xAxisIndex: 0, yAxisIndex: 0,
        lineStyle: { width: 0, opacity: 0 },
        markLine: ([{ name: 'T-5m', xAxis: now - 5*60*1000, lineStyle: { color: '#1273EB', width: 4 } } as any].concat(markLineData as any)).length > 0 ? {
          symbol: ['none','none'],
          label: { show: true, formatter: (p: any) => (p?.name || ''), fontSize: 10 },
          tooltip: { show: true, formatter: (p: any) => {
            const t = p?.data?.task || p?.name || '';
            const dMb = typeof p?.data?.mbDown === 'number' ? Math.trunc(p.data.mbDown) : undefined;
            const uMb = typeof p?.data?.mbUp === 'number' ? Math.trunc(p.data.mbUp) : undefined;
            const line1 = dMb !== undefined ? `↓${dMb}MB` : '';
            const line2 = uMb !== undefined ? `↑${uMb}MB` : '';
            return `${t}${(line1||line2) ? `\n${line1} ${line2}` : ''}`;
          } },
          data: ([{ name: 'T-5m', xAxis: now - 5*60*1000, lineStyle: { color: '#1273EB', width: 4 } } as any].concat(markLineData as any)) as any,
          emphasis: { lineStyle: { width: 2 } },
          silent: true
        } : undefined
      }
    ]
  });
});

const anomalyOption = computed(() => {
  // Create mark lines for Starlink events
  const eventMarkLines = starlinkEvents.value.map(event => ({
    name: event.message,
    xAxis: event.timestamp,
    lineStyle: { color: event.color, width: 2, type: 'dashed' },
    label: { 
      show: true, 
      formatter: event.icon,
      fontSize: 14,
      color: event.color
    }
  }));
  
  if (eventMarkLines.length > 0) {
    const now = Date.now();
    const windowStart = now - (rangeSeconds.value * 1000);
    console.log(`📍 Creating ${eventMarkLines.length} mark lines for Anomaly chart:`, eventMarkLines.map(m => {
      // More inclusive boundary check - allow events within 2 minutes of window edges
      const inWindow = m.xAxis > (windowStart - 120000) && m.xAxis < (now + 120000);
      return { 
        time: new Intl.DateTimeFormat('en-US', { 
          timeZone: 'America/Los_Angeles', 
          month: 'short', day: 'numeric', 
          hour: '2-digit', minute: '2-digit', hour12: false 
        }).format(new Date(m.xAxis)),
        msg: m.name,
        inWindow: inWindow ? '✅' : '❌'
      };
    }));
    console.log(`📍 Current window: ${new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: false 
    }).format(new Date(windowStart))} to ${new Intl.DateTimeFormat('en-US', { 
      timeZone: 'America/Los_Angeles', 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: false 
    }).format(new Date(now))}`);
  }

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 40, top: 40, bottom: 40 },
    legend: { top: 6, data: ['Anomaly Rate (%)'] },
    xAxis: { 
      type: 'time',
      axisLabel: {
        formatter: (value: number) => new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(value))
      }
    },
    yAxis: [
      { 
        type: 'value', 
        name: '%', 
        min: 0, 
        max: 100,
        axisLabel: { 
          formatter: '{value}'
        }
      },
      // Dummy y-axes to match bandwidth chart structure for alignment
      { type: 'value', show: false, position: 'right', offset: 0 },
      { type: 'value', show: false, position: 'right', offset: 48 }
    ],
    series: [
      { 
        type: 'line', 
        name: 'Anomaly Rate (%)', 
        data: anomalySeries.value, 
        showSymbol: false, 
        smooth: true, 
        lineStyle: { width: 2, color: '#ff6b6b' },
        areaStyle: { color: 'rgba(255, 107, 107, 0.1)' },
        markLine: eventMarkLines.length > 0 ? {
          symbol: ['none', 'none'],
          data: eventMarkLines,
          label: { show: true, fontSize: 14 }
        } : undefined
      }
    ]
  };
});

function flagStyle(active: boolean) {
  return {
    marginTop: '8px',
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '8px',
    fontWeight: 600,
    color: active ? '#b30000' : '#0a7',
    background: active ? '#ffe6e6' : '#e7fff5',
    border: `1px solid ${active ? '#f5b5b5' : '#b7f0db'}`
  } as const;
}

function periodicityStyle(detected: boolean) {
  return {
    marginTop: '8px',
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: '8px',
    fontWeight: 600,
    color: detected ? '#856404' : '#666',
    background: detected ? '#fff3cd' : '#f5f5f5',
    border: `1px solid ${detected ? '#ffeaa7' : '#ddd'}`
  } as const;
}

function onBandwidthLegendChange(event: any) {
  // Save legend selection state to localStorage
  if (event && event.selected) {
    localStorage.setItem('levante_bandwidthLegend', JSON.stringify(event.selected));
  }
}

// Watch rangeSeconds and save to localStorage
watch(rangeSeconds, (newVal) => {
  localStorage.setItem('levante_rangeSeconds', String(newVal));
});

onMounted(() => {
  refreshAll();
  loadBenchRuns();
  // Refresh benchmark overlays every 60s without reloading full series
  setInterval(() => { loadBenchRuns(); }, 60000);
});
</script>

<script lang="ts">
export default {
  components: { 'v-chart': VChart }
}
</script>

<style>
html, body, #app { height: 100%; margin: 0; background: #f6f8fb; }
</style>
