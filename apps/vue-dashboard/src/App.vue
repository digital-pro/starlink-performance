<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Levante Performance</h1>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap; color:#667;">
        <small>Data Source: Prometheus (Grafana Cloud)</small>
        <a href="https://levanteperformance.grafana.net/d/eeb52d4b-07c7-4496-95cd-f06bd12aa41e/starlink-performance-advanced?from=now-6h&to=now&timezone=browser&refresh=30s" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #444; background:#222; color:white; border-radius:8px; text-decoration:none;">Open in Grafana</a>
        <a href="https://levanteperformance.grafana.net/public-dashboards/bf1r1cmlttr7kb" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #666; background:#444; color:white; border-radius:8px; text-decoration:none;">Public view</a>
        <button @click="refreshAll" style="padding:8px 12px; border:1px solid #08c; background:#08c; color:white; border-radius:8px; cursor:pointer;">Refresh</button>
      </div>
    </header>

    <section style="margin-top: 8px;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; color:#556; font-size: 13px;">
        <strong>Correlation (last 15m):</strong>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde;">Latency↔Drops: {{ formatCorr(corr.drops) }}</span>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde;">Latency↔CPU: {{ formatCorr(corr.cpu) }}</span>
        <span :style="flagStyle(corr.periodic)">15s periodicity: {{ corr.periodic ? 'YES' : 'no' }}</span>
      </div>
    </section>

    <!-- Top metric cards removed per request -->

    <!-- Totals -->
    <section style="margin-top: 12px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; min-width:200px;">
          <div style="font-size:12px; color:#778;">Total Download (last hour)</div>
          <div style="font-size:20px; font-weight:600;">{{ formatGb(totalDownGb) }} GB</div>
        </div>
      </div>
    </section>

    <section style="margin-top: 24px; display:grid; grid-template-columns: 1fr; gap: 16px;">
      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Starlink Diagnostics</h3>
          <small style="color:#778;">spike / micro-loss / outage / obstruction</small>
        </div>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-top:12px;">
          <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; display:flex; align-items:center; justify-content:center;">
            <span :style="flagStyle(flags.latencySpike)" title="Latency spike: starlink_latency_spike recording rule indicates short-term spike vs baseline">Latency spike</span>
          </div>
          <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; display:flex; align-items:center; justify-content:center;">
            <span :style="flagStyle(flags.microLoss)" title="Micro‑loss: sustained 1–2% packet loss typical on Starlink">Micro‑loss</span>
          </div>
          <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; display:flex; align-items:center; justify-content:center;">
            <span :style="flagStyle(flags.outage)" title="Outage: starlink_dish_outage_duration increasing">Outage active</span>
          </div>
          <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff; display:flex; align-items:center; justify-content:center;">
            <span :style="flagStyle(flags.obstruction)" title="Obstruction: wedge_abs_fraction_obstruction_ratio over threshold">Obstruction</span>
          </div>
        </div>
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;" title="Latency (ms) over time; packet loss (%) overlaid on right axis">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <h3 style="margin:0;">Latency (last 10 min)</h3>
            <button @click="openLossDetails" style="padding:4px 8px; border:1px solid #08c; background:#08c; color:white; border-radius:6px; cursor:pointer; font-size:12px;">Packet loss details</button>
          </div>
          <small style="color:#778;">starlink_latency_ms (recording rule)</small>
        </div>
        <div v-if="!hasLatencyData" style="height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No latency data in selected window</div>
        <v-chart v-else :option="latencyOption" autoresize style="height:120px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;" title="Bandwidth (Mbps) with micro-loss (%) overlaid on right axis">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bandwidth (Down / Up)</h3>
          <small style="color:#778;">starlink_down_mbps / starlink_up_mbps (recording rules)</small>
        </div>
        <div v-if="!hasBandwidthData" style="height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No bandwidth data in selected window</div>
        <v-chart v-else :option="bandwidthOption" autoresize style="height:120px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Preflight Issues</h3>
          <small style="color:#778;">GitHub</small>
        </div>
        <div v-if="ghLoading" style="padding:10px; color:#99a; font-size:12px;">Loading…</div>
        <div v-else-if="ghError" style="padding:10px; color:#a55; font-size:12px;">{{ ghError }}</div>
        <ul v-else style="margin:8px 0 0 0; padding:0 0 0 16px;">
          <li v-for="it in issues" :key="it.id" style="margin:6px 0;">
            <a :href="it.html_url" target="_blank" rel="noopener noreferrer">#{{ it.number }} {{ it.title }}</a>
            <small style="color:#778;"> ({{ it.state }})</small>
          </li>
          <li v-if="issues.length === 0" style="color:#99a; font-size:12px; list-style: none;">No open issues</li>
        </ul>
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
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent]);

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

function displayValue(key: typeof metricCards[number]['key']) {
  return format3(metrics.value[key]);
}

function formatCorr(v: number | 'N/A') {
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  return v;
}

function formatGb(v: number | 'N/A') {
  if (typeof v === 'number' && Number.isFinite(v)) return v.toFixed(2);
  return 'N/A';
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

async function refreshAll() {
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

  const fixedEnd = Math.floor(Date.now() / 1000);
  latencySeries.value = await fetchRangeProm(q.latency, 600, 10, fixedEnd);
  packetLossSeries.value = await fetchRangeProm(q.packetLoss, 600, 10, fixedEnd);
  const [down, up, ml] = await Promise.all([
    fetchRangeProm(q.bandwidthDown, 600, 10, fixedEnd),
    fetchRangeProm(q.bandwidthUp, 600, 10, fixedEnd),
    fetchRangeProm('starlink_micro_loss * 100', 600, 10, fixedEnd)
  ]);
  bandwidthDownSeries.value = down;
  bandwidthUpSeries.value = up;
  microLossSeries.value = ml;

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
const microLossSeries = ref<Array<[number, number]>>([]);
const packetLossSeries = ref<Array<[number, number]>>([]);

// GitHub Issues (Preflight)
const issues = ref<Array<{ id: number; number: number; title: string; html_url: string; state: string }>>([]);
const ghLoading = ref(false);
const ghError = ref<string | null>(null);

const hasLatencyData = computed(() => latencySeries.value.length > 0 || packetLossSeries.value.length > 0);
const hasBandwidthData = computed(() => bandwidthDownSeries.value.length > 0 || bandwidthUpSeries.value.length > 0 || microLossSeries.value.length > 0);

const latencyOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 24, bottom: 40 },
  xAxis: { type: 'time' },
  yAxis: [
    { type: 'value', name: 'ms' },
    { type: 'value', name: '%', position: 'right' }
  ],
  series: [
    { type: 'line', name: 'Latency', data: latencySeries.value, showSymbol: false, smooth: true, lineStyle: { width: 2 }, yAxisIndex: 0 },
    { type: 'line', name: 'Packet Loss (%)', data: packetLossSeries?.value || [], showSymbol: false, lineStyle: { width: 2, type: 'dashed' }, yAxisIndex: 1 }
  ]
}));

const bandwidthOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 24, bottom: 40 },
  xAxis: { type: 'time' },
  yAxis: [
    { type: 'value', name: 'Mbps' },
    { type: 'value', name: '%', position: 'right' }
  ],
  legend: { data: ['Down (Mbps)', 'Up (Mbps)', 'Micro-loss (%)'] },
  series: [
    { type: 'line', name: 'Down (Mbps)', data: bandwidthDownSeries.value, showSymbol: false, smooth: true, yAxisIndex: 0, lineStyle: { width: 2 } },
    { type: 'line', name: 'Up (Mbps)', data: bandwidthUpSeries.value, showSymbol: false, smooth: true, yAxisIndex: 0, lineStyle: { width: 2 } },
    { type: 'line', name: 'Micro-loss (%)', data: microLossSeries.value, showSymbol: false, yAxisIndex: 1, lineStyle: { type: 'dashed', width: 2 } }
  ]
}));

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

onMounted(() => {
  refreshAll();
  // Load preflight issues (expects GH_TOKEN/GH_REPO set server-side)
  (async () => {
    ghLoading.value = true;
    ghError.value = null;
    try {
      const r = await axios.get('/api/github-issues');
      const arr = r.data?.issues || [];
      issues.value = Array.isArray(arr) ? arr.slice(0, 10) : [];
    } catch (e: any) {
      ghError.value = 'Failed to load issues';
      issues.value = [];
    } finally {
      ghLoading.value = false;
    }
  })();
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
