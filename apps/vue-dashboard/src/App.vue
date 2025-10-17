<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Levante Performance (Vue)</h1>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap: wrap;">
        <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid #ddd; border-radius:8px; background:#fff;">
          <span>Data Source</span>
          <select v-model="dataSource" style="padding:6px 8px; border:1px solid #ddd; border-radius:6px;">
            <option value="netdata">Netdata</option>
            <option value="prom">Prometheus</option>
          </select>
        </label>
        <template v-if="dataSource==='netdata'">
          <input v-model="netdataHost" placeholder="NETDATA_HOST (e.g. 192.168.1.50)" style="padding:8px 12px; border:1px solid #ddd; border-radius:8px; width: 260px;"/>
          <button @click="saveHost" style="padding:8px 12px; border:1px solid #0a7; background:#0a7; color:white; border-radius:8px; cursor:pointer;">Save</button>
        </template>
        <template v-else>
          <small style="color:#667">Reads from serverless <code>/api/promql</code> (configure env PROM_URL on server)</small>
        </template>
        <button @click="refreshAll" style="padding:8px 12px; border:1px solid #08c; background:#08c; color:white; border-radius:8px; cursor:pointer;">Refresh</button>
      </div>
    </header>

    <section style="margin-top: 16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
      <div v-for="card in metricCards" :key="card.key" style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="font-weight:600; color:#445;">{{ card.title }}</div>
        <div style="font-size: 28px; margin-top: 8px; color:#111;">{{ displayValue(card.key) }}</div>
        <small style="color:#778;">Latest</small>
      </div>
    </section>

    <section style="margin-top: 24px; display:grid; grid-template-columns: 1fr; gap: 16px;">
      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Latency (last 10 min)</h3>
          <small style="color:#778;">{{ dataSource==='netdata' ? 'starlink.ping' : 'starlink_latency_ms' }}</small>
        </div>
        <v-chart :option="latencyOption" autoresize style="height:260px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bandwidth (Down / Up)</h3>
          <small style="color:#778;">{{ dataSource==='netdata' ? 'starlink.bandwidth_*' : 'starlink_bandwidth_*_mbps' }}</small>
        </div>
        <v-chart :option="bandwidthOption" autoresize style="height:260px; margin-top:8px;" />
      </div>
    </section>

    <footer style="margin-top: 24px; color:#667;">
      <small>
        Netdata via <code>/api/netdata</code> (set `NETDATA_URL` or `NETDATA_HOST`); Prometheus via <code>/api/promql</code> (set `PROM_URL` + auth). This is a starter UI; extend with alerts, gauges, and trend comparisons.
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

const dataSource = ref<'netdata' | 'prom'>((localStorage.getItem('DATA_SOURCE') as any) || 'netdata');
function saveDataSource() {
  localStorage.setItem('DATA_SOURCE', dataSource.value);
}

const netdataHost = ref<string>(localStorage.getItem('NETDATA_HOST') || '');
function saveHost() {
  localStorage.setItem('NETDATA_HOST', netdataHost.value);
}

const metrics = ref<Record<string, number | string>>({
  latency: 'N/A',
  packetLoss: 'N/A',
  bandwidthDown: 'N/A',
  bandwidthUp: 'N/A',
  anomalyRate: 'N/A'
});

const metricCards = [
  { key: 'latency', title: 'Latency (ms)' },
  { key: 'packetLoss', title: 'Packet Loss (%)' },
  { key: 'bandwidthDown', title: 'Down (Mbps)' },
  { key: 'bandwidthUp', title: 'Up (Mbps)' },
  { key: 'anomalyRate', title: 'Anomaly Rate (%)' }
] as const;

function displayValue(key: typeof metricCards[number]['key']) {
  return metrics.value[key];
}

// Netdata helpers
async function fetchLatestNetdata(chart: string): Promise<number | 'N/A'> {
  try {
    const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-300&points=1&format=json`);
    const data = res.data?.data;
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      return typeof last[0] === 'number' ? last[0] : 'N/A';
    }
    return 'N/A';
  } catch {
    return 'N/A';
  }
}

async function fetchSeriesNetdata(chart: string, seconds = 600, points = 100): Promise<Array<[number, number]>> {
  try {
    const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-${seconds}&points=${points}&format=json`);
    const data = res.data?.data as number[][] | undefined;
    if (!data || data.length === 0) return [];
    return data.map((row, idx) => {
      const step = seconds / Math.max(points, 1);
      const ts = (res.data?.view_latest || 0) - (seconds - step * idx);
      const value = row.find(v => typeof v === 'number') ?? NaN;
      return [ts * 1000, Number(value)];
    }).filter(pair => !Number.isNaN(pair[1]));
  } catch {
    return [];
  }
}

// Prometheus helpers
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

async function fetchRangeProm(query: string, seconds = 600, step = 10): Promise<Array<[number, number]>> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - seconds;
    const res = await axios.get(`/api/promql`, { params: { query, start, end, step } });
    const result = res.data?.data?.result;
    if (!Array.isArray(result) || result.length === 0) return [];
    const values = result[0]?.values as Array<[number, string]> | undefined;
    if (!values) return [];
    return values.map(([ts, v]) => [Number(ts) * 1000, Number(v)]).filter(([, v]) => Number.isFinite(v));
  } catch {
    return [];
  }
}

async function refreshAll() {
  saveDataSource();
  if (dataSource.value === 'netdata') {
    const charts: Record<string, string> = {
      latency: 'starlink.ping',
      packetLoss: 'starlink.packet_loss',
      bandwidthDown: 'starlink.bandwidth_down',
      bandwidthUp: 'starlink.bandwidth_up',
      anomalyRate: 'anomaly_detection.anomaly_rate'
    };
    await Promise.all(
      Object.entries(charts).map(async ([key, chart]) => {
        metrics.value[key] = await fetchLatestNetdata(chart);
      })
    );
    latencySeries.value = await fetchSeriesNetdata('starlink.ping', 600, 100);
    const [down, up] = await Promise.all([
      fetchSeriesNetdata('starlink.bandwidth_down', 600, 100),
      fetchSeriesNetdata('starlink.bandwidth_up', 600, 100)
    ]);
    bandwidthDownSeries.value = down;
    bandwidthUpSeries.value = up;
  } else {
    const q = {
      latency: 'starlink_latency_ms',
      packetLoss: 'starlink_packet_loss_pct',
      bandwidthDown: 'starlink_bandwidth_down_mbps',
      bandwidthUp: 'starlink_bandwidth_up_mbps',
      anomalyRate: 'starlink_anomaly_rate_pct'
    } as const;
    await Promise.all(
      (Object.keys(q) as Array<keyof typeof q>).map(async (k) => {
        metrics.value[k] = await fetchInstantProm(q[k]);
      })
    );
    latencySeries.value = await fetchRangeProm('starlink_latency_ms', 600, 10);
    const [down, up] = await Promise.all([
      fetchRangeProm('starlink_bandwidth_down_mbps', 600, 10),
      fetchRangeProm('starlink_bandwidth_up_mbps', 600, 10)
    ]);
    bandwidthDownSeries.value = down;
    bandwidthUpSeries.value = up;
  }
}

const latencySeries = ref<Array<[number, number]>>([]);
const bandwidthDownSeries = ref<Array<[number, number]>>([]);
const bandwidthUpSeries = ref<Array<[number, number]>>([]);

const latencyOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 24, bottom: 40 },
  xAxis: { type: 'time' },
  yAxis: { type: 'value', name: 'ms' },
  series: [
    { type: 'line', name: 'Latency', data: latencySeries.value, showSymbol: false, smooth: true }
  ]
}));

const bandwidthOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 24, bottom: 40 },
  xAxis: { type: 'time' },
  yAxis: { type: 'value', name: 'Mbps' },
  legend: { data: ['Down', 'Up'] },
  series: [
    { type: 'line', name: 'Down', data: bandwidthDownSeries.value, showSymbol: false, smooth: true },
    { type: 'line', name: 'Up', data: bandwidthUpSeries.value, showSymbol: false, smooth: true }
  ]
}));

onMounted(() => {
  refreshAll();
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
