<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Levante Performance (Vue)</h1>
      <div style="display:flex; gap:8px; align-items:center;">
        <input v-model="netdataHost" placeholder="NETDATA_HOST (e.g. 192.168.1.50)" style="padding:8px 12px; border:1px solid #ddd; border-radius:8px; width: 260px;"/>
        <button @click="saveHost" style="padding:8px 12px; border:1px solid #0a7; background:#0a7; color:white; border-radius:8px; cursor:pointer;">Save</button>
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
          <h3 style="margin:0;">Latency (last 5 min)</h3>
          <small style="color:#778;">starlink.ping</small>
        </div>
        <v-chart :option="latencyOption" autoresize style="height:260px; margin-top:8px;" />
      </div>

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Bandwidth (Down / Up)</h3>
          <small style="color:#778;">starlink.bandwidth_down / starlink.bandwidth_up</small>
        </div>
        <v-chart :option="bandwidthOption" autoresize style="height:260px; margin-top:8px;" />
      </div>
    </section>

    <footer style="margin-top: 24px; color:#667;">
      <small>
        Data proxied via <code>/api/netdata</code>. Configure `NETDATA_HOST` in Vercel or above. This is a starter UI; extend with alerts, gauges, and trend comparisons.
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

async function fetchLatest(chart: string): Promise<number | 'N/A'> {
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

async function refreshAll() {
  const charts: Record<string, string> = {
    latency: 'starlink.ping',
    packetLoss: 'starlink.packet_loss',
    bandwidthDown: 'starlink.bandwidth_down',
    bandwidthUp: 'starlink.bandwidth_up',
    anomalyRate: 'anomaly_detection.anomaly_rate'
  };
  await Promise.all(
    Object.entries(charts).map(async ([key, chart]) => {
      const v = await fetchLatest(chart);
      metrics.value[key] = v;
    })
  );
  await Promise.all([loadLatencySeries(), loadBandwidthSeries()]);
}

const latencySeries = ref<Array<[number, number]>>([]);
const bandwidthDownSeries = ref<Array<[number, number]>>([]);
const bandwidthUpSeries = ref<Array<[number, number]>>([]);

async function fetchSeries(chart: string, seconds = 300, points = 60): Promise<Array<[number, number]>> {
  try {
    const res = await axios.get(`/api/netdata?chart=${encodeURIComponent(chart)}&after=-${seconds}&points=${points}&format=json`);
    const labels = res.data?.labels as string[] | undefined;
    const data = res.data?.data as number[][] | undefined;
    if (!labels || !data || data.length === 0) return [];

    // Netdata typically returns arrays where the value is at index 0 or 1 depending on chart; take the last numeric entry
    return data
      .map(row => {
        const ts = (res.data?.view_latest || 0) - (seconds - (seconds / points) * data.indexOf(row));
        const value = row.find(v => typeof v === 'number') ?? NaN;
        return [ts * 1000, Number(value)];
      })
      .filter(pair => !Number.isNaN(pair[1]));
  } catch {
    return [];
  }
}

async function loadLatencySeries() {
  latencySeries.value = await fetchSeries('starlink.ping', 600, 100);
}
async function loadBandwidthSeries() {
  const [down, up] = await Promise.all([
    fetchSeries('starlink.bandwidth_down', 600, 100),
    fetchSeries('starlink.bandwidth_up', 600, 100)
  ]);
  bandwidthDownSeries.value = down;
  bandwidthUpSeries.value = up;
}

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
