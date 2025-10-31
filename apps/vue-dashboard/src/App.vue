<template>
  <main style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif; padding: 24px; max-width: 1200px; margin: 0 auto;">
    <header style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap: wrap;">
      <h1 style="margin:0; font-size: 24px;">Starlink Performance</h1>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap: wrap; color:#667;">
        <small>Data Source: Prometheus (Grafana Cloud)</small>
        <a href="https://levanteperformance.grafana.net/d/ab8a8fa9-8d9c-47df-928b-9db5a89a5bca/starlink-performance-10-25?orgId=1&from=now-6h&to=now&timezone=browser&refresh=30s&showCategory=Panel%20options" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #444; background:#222; color:white; border-radius:8px; text-decoration:none;">Open in Grafana</a>
        <a href="https://levanteperformance.grafana.net/public-dashboards/ec38f814efb64ce6a2d1d4b7977cc83e?from=now-6h&to=now&timezone=browser" target="_blank" rel="noopener noreferrer" style="padding:8px 12px; border:1px solid #666; background:#444; color:white; border-radius:8px; text-decoration:none;">Public view</a>
      </div>
    </header>

    <section style="margin-top: 8px;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; color:#556; font-size: 13px;">
        <strong>Correlation (last 15m):</strong>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde; display:inline-flex; align-items:center;" title="Correlation coefficient between latency and packet drops over the last 15 minutes. Values closer to +1 or -1 indicate stronger correlation. Range: -1 to +1.">Latency↔Drops: {{ typeof corr.drops === 'number' && Number.isFinite(corr.drops) ? corr.drops.toFixed(2) : 'N/A' }}</span>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde; display:inline-flex; align-items:center;" title="Correlation coefficient between latency and CPU usage over the last 15 minutes. Positive values suggest CPU load may be impacting network performance. Range: -1 to +1.">Latency↔CPU: {{ typeof corr.cpu === 'number' && Number.isFinite(corr.cpu) ? corr.cpu.toFixed(2) : 'N/A' }}</span>
        <span style="padding:4px 8px; border-radius:8px; background:#eef; border:1px solid #dde; display:inline-flex; align-items:center;" :style="periodicityStyle(corr.periodic)" title="Detects if latency shows a repeating pattern every ~15 seconds via autocorrelation analysis. YES (yellow) indicates periodic spikes, which may suggest scheduled processes, satellite beam switching, or regular interference. NO means variations appear random or follow a different pattern.">15s periodicity: {{ corr.periodic ? 'YES' : 'no' }}</span>
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
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px;">
          <div style="border:1px solid #eee; border-radius:10px; padding:8px; background:#fff;" title="Sum of downlink Mbps over last hour converted to GB (assumes 15s scrape interval)">
            <div style="font-size:11px; color:#778;">Download (last hour)</div>
            <div style="font-size:18px; font-weight:600;">{{ typeof totalDownGb === 'number' ? totalDownGb.toFixed(2) : 'N/A' }} GB</div>
          </div>
          <div style="border:1px solid #eee; border-radius:10px; padding:8px; background:#fff;" title="Windows WiFi adapter link speed (Mbps). This is the negotiated connection speed between your WiFi adapter and Starlink router.">
            <div style="font-size:11px; color:#778;">WiFi Speed</div>
            <div style="font-size:18px; font-weight:600;">{{ typeof nicSpeedMbps === 'number' && Number.isFinite(nicSpeedMbps) ? Math.floor(nicSpeedMbps) : 'N/A' }} Mbps</div>
          </div>
          <div style="border:1px solid #eee; border-radius:10px; padding:8px; background:#fff;" title="GPS location of Starlink dish">
            <div style="font-size:11px; color:#778;">Location</div>
            <div style="display:flex; align-items:center; gap:4px;">
              <div style="font-size:16px; font-weight:600;">{{ formatGpsLocation() }}</div>
              <img 
                v-if="gpsLatitude !== null && gpsLongitude !== null"
                @click="showMapModal = true"
                :src="`https://maps.googleapis.com/maps/api/staticmap?center=${gpsLatitude},${gpsLongitude}&zoom=15&size=60x60&markers=color:red%7C${gpsLatitude},${gpsLongitude}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6d13V3-kNgJGLrI`"
                alt="Location map"
                style="cursor:pointer; width:28px; height:28px; border-radius:3px; border:1px solid #ddd; flex-shrink:0;"
                title="Click to open larger map"
              />
            </div>
          </div>
        </div>
        <div style="border:1px solid #eee; border-radius:10px; padding:10px; background:#fff;" title="Diagnostic flags derived from recording rules for common issues">
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

      <div style="border:1px solid #eee; border-radius:12px; padding:12px; background:white;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Anomaly Detection & Starlink Events</h3>
          <small style="color:#778;">netdata anomaly rate + state changes</small>
        </div>
        <div v-if="!hasAnomalyData && starlinkEvents.length === 0" style="height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px;">No data in selected window</div>
        <v-chart v-else :option="anomalyOption" autoresize style="height:120px; margin-top:8px;" />
      </div>

      
    </section>

    <!-- GPS Map Modal -->
    <div v-if="showMapModal && gpsLatitude !== null && gpsLongitude !== null" style="position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999;" @click="showMapModal = false">
      <div style="width: min(800px, 95%); height: min(600px, 90%); background:white; border-radius:12px; border:1px solid #ddd; box-shadow:0 6px 24px rgba(0,0,0,0.2); display:flex; flex-direction:column;" @click.stop>
        <div style="padding:12px 16px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;">
          <h3 style="margin:0;">Starlink Dish Location</h3>
          <button @click="showMapModal = false" style="padding:4px 8px; border:1px solid #999; background:#f5f5f5; color:#333; border-radius:6px; cursor:pointer; font-size:12px;">Close</button>
        </div>
        <div style="flex:1; padding:16px;">
          <iframe 
            :src="`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6d13V3-kNgJGLrI&q=${gpsLatitude},${gpsLongitude}&zoom=15`"
            width="100%" 
            height="100%" 
            style="border:0; border-radius:8px;" 
            allowfullscreen 
            loading="lazy">
          </iframe>
        </div>
      </div>
    </div>

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

    <!-- Diagnostic Charts Section -->
    <section style="margin-top: 24px;">
      <h3 style="margin:0 0 12px 0; color:#334;">Connection Diagnostics</h3>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
        <!-- SNR Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">SNR (dB)</div>
          <div v-if="snrSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="snrOption" autoresize style="height:80px;" />
        </div>

        <!-- Dish State Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Dish State</div>
          <div v-if="dishStateSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="dishStateOption" autoresize style="height:80px;" />
        </div>

        <!-- Backup Beam Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Backup Beam</div>
          <div v-if="backupBeamSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="backupBeamOption" autoresize style="height:80px;" />
        </div>

        <!-- Time to Slot End Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Time to Slot End (s)</div>
          <div v-if="slotEndSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="slotEndOption" autoresize style="height:80px;" />
        </div>

        <!-- Bore Sight Azimuth Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Azimuth (deg)</div>
          <div v-if="azimuthSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="azimuthOption" autoresize style="height:80px;" />
        </div>

        <!-- Bore Sight Elevation Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Elevation (deg)</div>
          <div v-if="elevationSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="elevationOption" autoresize style="height:80px;" />
        </div>

        <!-- Time to First Nonempty Slot Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">First Slot (s)</div>
          <div v-if="firstSlotSeries.length === 0" style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="firstSlotOption" autoresize style="height:80px;" />
        </div>

        <!-- Placeholder for 8th chart (can add alerts later) -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Alerts</div>
          <div style="height:80px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">Coming soon</div>
        </div>
      </div>
    </section>
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
const gpsLatitude = ref<number | null>(null);
const gpsLongitude = ref<number | null>(null);
const showMapModal = ref(false);
// bucket info removed
// Initialize rangeSeconds from localStorage, default to 1 hour
const storedRange = localStorage.getItem('starlink_rangeSeconds');
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
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n.toFixed(2);
    return value;
  }
  return value;
}

const formatTooltipValue = (value: number | string): string => {
  const num = Number(value);
  if (Number.isFinite(num)) return num.toFixed(2);
  return typeof value === 'string' ? value : '';
};

function formatGpsLocation(): string {
  if (gpsLatitude.value !== null && gpsLongitude.value !== null) {
    return `${gpsLatitude.value.toFixed(1)}, ${gpsLongitude.value.toFixed(1)}`;
  }
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

function clampSeriesPercentile(series: Array<[number, number]>, percentile = 0.98, factor = 1.5, hardMax?: number): Array<[number, number]> {
  if (!Array.isArray(series) || series.length === 0) return series;
  const values = series.map(([, v]) => Number(v)).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (values.length === 0) return series;
  const idx = Math.max(0, Math.min(values.length - 1, Math.floor(percentile * (values.length - 1))));
  const p = values[idx];
  const maxVal = hardMax !== undefined 
    ? Math.min(p * factor, hardMax) 
    : p * factor;
  return series.map(([t, v]) => [t, Math.min(Math.max(0, Number(v)), maxVal)] as [number, number]);
}

async function computeRunMb(run: { start: number; end: number }) {
  const durationMs = Math.max(0, (run.end || 0) - (run.start || 0));
  if (durationMs <= 0) return { mbDown: 0, mbUp: 0 };
  const seconds = Math.ceil(durationMs / 1000);
  const step = 10; // seconds
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
  
  // Use trapezoidal integration with robust outlier rejection (median/MAD clamp)
  const integrateThroughputToMb = (series: Array<[number, number]>) => {
    if (series.length < 2) return 0;
    // Clean and gather finite, non-negative samples
    const cleaned: Array<[number, number]> = [];
    const values: number[] = [];
    for (const [t, vRaw] of series) {
      const v = Number(vRaw);
      if (Number.isFinite(v) && v >= 0 && Number.isFinite(t)) {
        cleaned.push([t, v]);
        values.push(v);
      }
    }
    if (cleaned.length < 2) return 0;
    // Compute robust center and scale using median and MAD
    const sorted = values.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const absDevs = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
    const mad = absDevs[Math.floor(absDevs.length / 2)] || 0; // median absolute deviation
    // Convert MAD to an approximate standard deviation (sigma ≈ 1.4826 * MAD)
    const sigma = (mad || 0) * 1.4826;
    // Clamp extreme spikes above median + 6σ (very conservative), minimum floor 10KB/s
    const clampMax = Math.max(1e4, median + 6 * sigma);
    let totalBytes = 0;
    for (let i = 0; i < cleaned.length - 1; i++) {
      const [t1, v1raw] = cleaned[i];
      const [t2, v2raw] = cleaned[i + 1];
      const dtSec = (t2 - t1) / 1000;
      if (!Number.isFinite(dtSec) || dtSec <= 0 || dtSec > 60) continue; // ignore gaps and timebase spikes
      const v1 = Math.min(v1raw, clampMax);
      const v2 = Math.min(v2raw, clampMax);
      const avgBytesPerSec = (v1 + v2) / 2;
      totalBytes += avgBytesPerSec * dtSec;
    }
    return totalBytes / 1e6;
  };
  
  const rawDown = integrateThroughputToMb(downSeries);
  const rawUp = integrateThroughputToMb(upSeries);
  
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

  // WiFi link speed (Mbps): windows_wifi_link_speed_mbps - connection speed between computer and Starlink router
  const wifi = await fetchInstantProm('windows_wifi_link_speed_mbps');
  nicSpeedMbps.value = typeof wifi === 'number' && Number.isFinite(wifi) ? wifi : 'N/A';

  // GPS location
  const [gpsLat, gpsLon] = await Promise.all([
    fetchInstantProm('starlink_dish_gps_latitude'),
    fetchInstantProm('starlink_dish_gps_longitude')
  ]);
  gpsLatitude.value = typeof gpsLat === 'number' && Number.isFinite(gpsLat) ? gpsLat : null;
  gpsLongitude.value = typeof gpsLon === 'number' && Number.isFinite(gpsLon) ? gpsLon : null;

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
  // Clamp MB/min and MB/10m to reduce unrealistic spikes from transient exporter outliers
  // Hard cap: Starlink max theoretical is ~300 Mbps = ~37.5 MB/s = ~2250 MB/min, so cap at 3000 MB/min for safety
  // Use 95th percentile (more aggressive) with 1.3x factor to catch outliers
  downMbPerMinSeries.value = clampSeriesPercentile(downMBm, 0.95, 1.3, 3000);
  upMbPerMinSeries.value = clampSeriesPercentile(upMBm, 0.95, 1.3, 3000);
  downMbPer10MinSeries.value = clampSeriesPercentile(downMB10, 0.95, 1.3, 30000);
  upMbPer10MinSeries.value = clampSeriesPercentile(upMB10, 0.95, 1.3, 30000);

  // Anomaly detection
  anomalySeries.value = await fetchRangeProm('netdata_anomaly_detection_anomaly_rate_percentage_average', seconds, step, fixedEnd);
  console.log(`📊 Anomaly series: ${anomalySeries.value.length} data points`);

  // Diagnostic charts
  const [snr, dishState, backupBeam, slotEnd, azimuth, elevation, firstSlot] = await Promise.all([
    fetchRangeProm('starlink_dish_snr', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_state', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_backup_beam', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_time_to_slot_end_seconds', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_bore_sight_azimuth_deg', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_bore_sight_elevation_deg', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_first_nonempty_slot_seconds', seconds, step, fixedEnd)
  ]);
  snrSeries.value = snr;
  dishStateSeries.value = dishState;
  backupBeamSeries.value = backupBeam;
  slotEndSeries.value = slotEnd;
  azimuthSeries.value = azimuth;
  elevationSeries.value = elevation;
  firstSlotSeries.value = firstSlot;

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
    const toNum = (x: any) => (x !== null && x !== undefined && typeof x === 'number' && Number.isFinite(x)) ? x : 'N/A';
    corr.value.drops = toNum(c.latency_vs_drops);
    corr.value.cpu = toNum(c.latency_vs_cpu);
    corr.value.ac15 = toNum(p.ac_15s);
    corr.value.periodic = Boolean(p.detected);
    console.log('Correlation data:', { drops: corr.value.drops, cpu: corr.value.cpu, periodic: corr.value.periodic });
  } catch (e) {
    console.error('Failed to fetch correlation:', e);
    corr.value = { drops: 'N/A', cpu: 'N/A', ac15: 'N/A', periodic: false };
  }

  // Starlink Events: detect state changes and obstructions
  await loadStarlinkEvents(seconds, 30, fixedEnd);
}

async function loadStarlinkEvents(seconds: number, step: number, fixedEnd: number) {
  const events: Array<{ time: string; timestamp: number; message: string; icon: string; color: string }> = [];
  
  try {
    // Fetch metrics for smart event detection
    const [downThroughput, upThroughput, obstructionFraction, packetLoss, latency] = await Promise.all([
      fetchRangeProm('starlink_dish_downlink_throughput_bytes', seconds, step, fixedEnd),    // User download (satellite→dish)
      fetchRangeProm('starlink_dish_uplink_throughput_bytes', seconds, step, fixedEnd),      // User upload (dish→satellite)
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
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
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

// Diagnostic charts series
const snrSeries = ref<Array<[number, number]>>([]);
const dishStateSeries = ref<Array<[number, number]>>([]);
const backupBeamSeries = ref<Array<[number, number]>>([]);
const slotEndSeries = ref<Array<[number, number]>>([]);
const azimuthSeries = ref<Array<[number, number]>>([]);
const elevationSeries = ref<Array<[number, number]>>([]);
const firstSlotSeries = ref<Array<[number, number]>>([]);


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
    tooltip: { trigger: 'axis', valueFormatter: formatTooltipValue },
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
          silent: false
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
  const storedLegend = localStorage.getItem('starlink_bandwidthLegend');
  const legendSelected = storedLegend ? JSON.parse(storedLegend) : undefined;

  return ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: formatTooltipValue
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
          silent: false
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
    icon: event.icon,
    label: { 
      show: true, 
      formatter: (p: any) => {
        const ts = typeof p?.data?.xAxis === 'number' ? p.data.xAxis : undefined;
        const time = typeof ts === 'number' ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(new Date(ts)) : '';
        const icon = p?.data?.icon || '';
        return time ? `${icon} ${time}` : icon;
      },
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
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
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
    tooltip: { trigger: 'item', valueFormatter: formatTooltipValue },
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
        tooltip: { show: false },
        lineStyle: { width: 2, color: '#ff6b6b' },
        areaStyle: { color: 'rgba(255, 107, 107, 0.1)' },
        markLine: eventMarkLines.length > 0 ? {
          symbol: ['none', 'none'],
          data: eventMarkLines,
          label: { show: true, fontSize: 14 },
          tooltip: { 
            show: true, 
            formatter: (p: any) => {
              const name = p?.data?.name || p?.name || '';
              const ts = typeof p?.data?.xAxis === 'number' ? p.data.xAxis : undefined;
              const time = typeof ts === 'number' ? new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
              }).format(new Date(ts)) : '';
              return time ? `${name}\n${time}` : name;
            }
          }
        } : undefined
      }
    ]
  };
});

// Diagnostic chart options
const snrOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'dB', min: 0 },
    series: [{
      type: 'line',
      name: 'SNR',
      data: snrSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#4a90e2' },
      areaStyle: { color: 'rgba(74, 144, 226, 0.1)' }
    }]
  };
});

const dishStateOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'State', min: 0, max: 3 },
    series: [{
      type: 'line',
      name: 'State',
      data: dishStateSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#50c878' },
      areaStyle: { color: 'rgba(80, 200, 120, 0.1)' }
    }]
  };
});

const backupBeamOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'Backup', min: 0, max: 1 },
    series: [{
      type: 'line',
      name: 'Backup Beam',
      data: backupBeamSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#ff9500' },
      areaStyle: { color: 'rgba(255, 149, 0, 0.1)' }
    }]
  };
});

const slotEndOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 's' },
    series: [{
      type: 'line',
      name: 'Slot End',
      data: slotEndSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#9b59b6' },
      areaStyle: { color: 'rgba(155, 89, 182, 0.1)' }
    }]
  };
});

const azimuthOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'deg' },
    series: [{
      type: 'line',
      name: 'Azimuth',
      data: azimuthSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#e74c3c' },
      areaStyle: { color: 'rgba(231, 76, 60, 0.1)' }
    }]
  };
});

const elevationOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'deg' },
    series: [{
      type: 'line',
      name: 'Elevation',
      data: elevationSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#16a085' },
      areaStyle: { color: 'rgba(22, 160, 133, 0.1)' }
    }]
  };
});

const firstSlotOption = computed(() => {
  const now = Date.now();
  const windowStart = now - (rangeSeconds.value * 1000);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 's' },
    series: [{
      type: 'line',
      name: 'First Slot',
      data: firstSlotSeries.value.filter(([t]) => t >= windowStart),
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#c0392b' },
      areaStyle: { color: 'rgba(192, 57, 43, 0.1)' }
    }]
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
    padding: '4px 8px',
    borderRadius: '8px',
    background: detected ? '#fff3cd' : '#eef',
    border: detected ? '1px solid #ffeaa7' : '1px solid #dde',
    display: 'inline-flex',
    alignItems: 'center'
  } as const;
}

function onBandwidthLegendChange(event: any) {
  // Save legend selection state to localStorage
  if (event && event.selected) {
    localStorage.setItem('starlink_bandwidthLegend', JSON.stringify(event.selected));
  }
}

// Watch rangeSeconds and save to localStorage
watch(rangeSeconds, (newVal) => {
  localStorage.setItem('starlink_rangeSeconds', String(newVal));
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
