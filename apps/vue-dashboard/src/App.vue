<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Levante Performance</h1>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap; color:#667;">
        <small>Data Source: Prometheus (Grafana Cloud)</small>
        <button @click="refreshAll" style="padding:8px 12px; border:1px solid #08c; background:#08c; color:white; border-radius:8px; cursor:pointer;">Refresh</button>
      </div>
    </header>

    <section style="margin-top: 16px; display:grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: 12px;">
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
          <small style="color:#778;">starlink_dish_pop_ping_latency_seconds × 1000</small>
        </div>
        <v-chart :option="latencyOption" autoresize style="height:260px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bandwidth (Down / Up)</h3>
          <small style="color:#778;">rate(starlink_dish_*_throughput_bytes[5m]) × 8 / 1e6</small>
        </div>
        <v-chart :option="bandwidthOption" autoresize style="height:260px; margin-top:8px;" />
      </div>
    </section>

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
    const mapped = values.map(([ts, v]) => [Number(ts) * 1000, Number(v)] as [number, number]);
    return mapped.filter(([, v]) => Number.isFinite(v));
  } catch {
    return [];
  }
}

async function refreshAll() {
  // Use actual Starlink exporter metrics
  const q = {
    latency: 'starlink_dish_pop_ping_latency_seconds * 1000',
    packetLoss: 'starlink_dish_pop_ping_drop_ratio * 100',
    bandwidthDown: 'rate(starlink_dish_downlink_throughput_bytes[5m]) * 8 / 1000000',
    bandwidthUp: 'rate(starlink_dish_uplink_throughput_bytes[5m]) * 8 / 1000000'
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

  latencySeries.value = await fetchRangeProm(q.latency, 600, 10);
  const [down, up] = await Promise.all([
    fetchRangeProm(q.bandwidthDown, 600, 10),
    fetchRangeProm(q.bandwidthUp, 600, 10)
  ]);
  bandwidthDownSeries.value = down;
  bandwidthUpSeries.value = up;
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
