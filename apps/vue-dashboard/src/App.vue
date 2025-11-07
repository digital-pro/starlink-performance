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
        <label style="display:flex; align-items:center; gap:4px; font-size:12px; color:#556;">
          <span>Offset:</span>
          <input v-model.number="rangeShiftMinutes" type="number" min="0" step="30" style="width:60px; padding:3px 6px; border:1px solid #ccd; border-radius:6px; text-align:right;" />
          <span>min</span>
        </label>
        <div style="display:flex; gap:8px; align-items:center; margin-left:auto;">
          <button @click="refreshAll" style="padding:6px 10px; border:1px solid #08c; background:#08c; color:white; border-radius:6px; cursor:pointer; font-size:12px;">Refresh</button>
          <button @click="showSettings = true" style="padding:6px 10px; border:1px solid #555; background:#fff; color:#333; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; gap:6px;">
            <span style="font-size:14px;">⚙</span>
            Settings
          </button>
        </div>
      </div>
    </section>


    <!-- Top metric cards removed per request -->

    <!-- Totals and Diagnostics in one row -->
    <section style="margin-top: 12px;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:8px;">
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
        <div style="border:1px solid #eee; border-radius:10px; padding:8px; background:#fff;">
          <div style="font-size:11px; color:#778; display:flex; justify-content:space-between; align-items:center;">
            <span>Internet at a Glance</span>
            <span style="font-size:10px; color:#999;">Server: {{ speedtestServerLabel }}</span>
          </div>
          <div v-if="metrics.speedtestDown === 'N/A' || metrics.speedtestUp === 'N/A'" style="font-size:11px; color:#99a; margin-top:12px;">
            Run the iPerf speedtest exporter to populate this card.
          </div>
          <div v-else style="display:flex; flex-direction:column; gap:2px; margin-top:6px;">
            <div style="font-size:16px; font-weight:600; color:#1a73e8;">↓ {{ formatSpeedMetric(metrics.speedtestDown) }}</div>
            <div style="font-size:16px; font-weight:600; color:#34a853;">↑ {{ formatSpeedMetric(metrics.speedtestUp) }}</div>
            <div style="font-size:11px; color:#667;">Updated {{ formatRelativeTimestamp(metrics.speedtestUpdated) }} · Cadence {{ speedtestCadenceLabel }}</div>
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

    <!-- Settings Modal -->
    <div v-if="showSettings" style="position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999;">
      <div style="width: min(640px, 92%); background:white; border-radius:12px; border:1px solid #ddd; box-shadow:0 6px 24px rgba(0,0,0,0.2);">
        <div style="padding:14px 18px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content:space-between;">
          <h3 style="margin:0;">Dashboard Settings</h3>
          <button @click="closeSettings" style="padding:4px 8px; border:1px solid #999; background:#f5f5f5; color:#333; border-radius:6px; cursor:pointer; font-size:12px;">Close</button>
        </div>
        <div style="padding:18px 20px; display:flex; flex-direction:column; gap:18px;">
          <section>
            <h4 style="margin:0 0 8px 0; font-size:14px; color:#334;">Logging interval</h4>
            <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end;">
              <label style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#445;">
                <span>Logging cadence (seconds)</span>
                <input v-model.number="loggingIntervalSeconds" type="number" min="5" step="5" style="width:120px; padding:6px 8px; border:1px solid #ccd; border-radius:6px; text-align:right;" />
              </label>
              <span style="font-size:12px; color:#667; max-width:320px;">Controls how often the local session notes logger writes to disk. Does not affect Prometheus scrape cadence.</span>
            </div>
          </section>

          <section>
            <h4 style="margin:0 0 8px 0; font-size:14px; color:#334;">Logging & notes</h4>
            <p style="margin:0 0 12px 0; font-size:12px; color:#667;">Add context for current monitoring session.</p>
            <textarea v-model="sessionNotes" placeholder="e.g. weather, customer activity, recent restarts" style="width:100%; min-height:90px; padding:8px; border:1px solid #ccd; border-radius:6px; font-size:12px; color:#445;"></textarea>
          </section>

          <section>
            <h4 style="margin:0 0 8px 0; font-size:14px; color:#334;">Internet at a Glance speedtest</h4>
            <p style="margin:0 0 12px 0; font-size:12px; color:#667;">These selections help keep the dashboard and the local exporter in sync. Make sure the exporter is launched with the same server and cadence.</p>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
              <label style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#445;">
                <span>Preferred server</span>
                <select v-model="speedtestSettings.server" style="padding:6px 8px; border:1px solid #ccd; border-radius:6px;">
                  <option v-for="opt in speedtestServerOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </label>
              <label style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#445;">
                <span>Run every (minutes)</span>
                <input v-model.number="speedtestSettings.intervalMinutes" type="number" min="5" step="5" style="padding:6px 8px; border:1px solid #ccd; border-radius:6px;" />
              </label>
            </div>
            <div style="margin-top:10px; font-size:11px; color:#667;">
              Exporter command: <code style="background:#f5f5f5; padding:2px 4px; border-radius:4px;">SPEEDTEST_SERVER={{ speedtestSettings.server }} SPEEDTEST_INTERVAL_SECONDS={{ speedtestSettings.intervalMinutes * 60 }} npm run speedtest:exporter</code>
            </div>
          </section>

          <div />
        </div>
      </div>
    </div>

    <!-- Diagnostic Charts Section -->
    <section style="margin-top: 24px;">
      <h3 style="margin:0 0 12px 0; color:#334;">Connection Diagnostics</h3>
      <div style="display:grid; grid-template-columns: minmax(200px, 1fr) repeat(3, minmax(0, 1fr)); gap:8px; grid-auto-rows: 150px; align-items:stretch;">
        <!-- Azimuth Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white; grid-column:1; grid-row:1;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Azimuth (deg)</div>
          <div v-if="azimuthSeries.length === 0" style="height:100%; min-height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="azimuthOption" autoresize style="height:120px;" />
        </div>

        <!-- Elevation Chart -->
        <div style="border:1px solid #eee; border-radius:8px; padding:8px; background:white; grid-column:1; grid-row:2;">
          <div style="font-size:11px; color:#778; margin-bottom:4px;">Elevation (deg)</div>
          <div v-if="elevationSeries.length === 0" style="height:100%; min-height:120px; display:flex; align-items:center; justify-content:center; color:#99a; font-size:11px;">No data</div>
          <v-chart v-else :option="elevationOption" autoresize style="height:120px;" />
        </div>

        <!-- Speedtest Supercard -->
        <div style="border:1px solid #eee; border-radius:8px; padding:12px; background:white; grid-column:2 / span 3; grid-row:1 / span 2; display:flex; flex-direction:column;">
          <div style="font-size:11px; color:#778; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span>Internet at a Glance</span>
            <span v-if="showSyntheticSpeedtest" style="font-size:10px; color:#999;">{{ speedtestServerLabel }} · every {{ speedtestCadenceLabel }}</span>
            <span v-else-if="hasFallbackSpeedData" style="font-size:10px; color:#999;">Synthetic test unavailable – showing live Starlink throughput</span>
            <span v-else style="font-size:10px; color:#999;">Synthetic and live metrics unavailable</span>
          </div>
          <div v-if="showSyntheticSpeedtest" style="flex:1; min-height:240px;">
            <v-chart :option="speedtestOption" autoresize style="height:100%;" />
          </div>
          <div v-else-if="hasFallbackSpeedData" style="flex:1; min-height:240px; display:flex; flex-direction:column; justify-content:center; gap:14px; color:#445;">
            <div style="font-size:11px; color:#8896af;">
              Synthetic iPerf tests are unavailable, so this card summarizes the live Starlink telemetry already charted above.
              Run the helper box speedtest exporter to restore synthetic results.
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; font-size:12px;">
              <div style="padding:10px; border:1px solid #f0f2f5; border-radius:8px; background:#fafbfd;">
                <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Current download</div>
                <div style="font-size:18px; font-weight:600; color:#1a73e8;">{{ formatSpeedMetric(fallbackDownInstant) }}</div>
                <div style="font-size:11px; color:#8896af;">{{ fallbackDownInstant !== null ? 'from telemetry' : 'waiting for samples' }}</div>
              </div>
              <div style="padding:10px; border:1px solid #f0f2f5; border-radius:8px; background:#fafbfd;">
                <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Current upload</div>
                <div style="font-size:18px; font-weight:600; color:#34a853;">{{ formatSpeedMetric(fallbackUpInstant) }}</div>
                <div style="font-size:11px; color:#8896af;">{{ fallbackUpInstant !== null ? 'from telemetry' : 'waiting for samples' }}</div>
              </div>
              <div style="padding:10px; border:1px solid #f0f2f5; border-radius:8px; background:#fafbfd;">
                <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Last minute data</div>
                <div style="font-size:15px; font-weight:600;">↓ {{ formatMegabytes(fallbackDownMbPerMin) }} · ↑ {{ formatMegabytes(fallbackUpMbPerMin) }}</div>
                <div style="font-size:11px; color:#8896af;">MB transferred in the most recent minute</div>
              </div>
              <div style="padding:10px; border:1px solid #f0f2f5; border-radius:8px; background:#fafbfd;">
                <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Last 10 minutes</div>
                <div style="font-size:15px; font-weight:600;">↓ {{ formatMegabytes(fallbackDownMbPer10m) }} · ↑ {{ formatMegabytes(fallbackUpMbPer10m) }}</div>
                <div style="font-size:11px; color:#8896af;">Telemetered throughput (MB / 10 min)</div>
              </div>
            </div>
          </div>
          <div v-else style="flex:1; display:flex; align-items:center; justify-content:center; color:#99a; font-size:12px; text-align:center; padding:0 16px;">
            Waiting for metrics. Ensure the iPerf exporter is running on the helper box.
          </div>
          <div style="margin-top:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:8px; font-size:12px; color:#445;">
            <div style="padding:8px; border:1px solid #f0f2f5; border-radius:6px; background:#fafbfd;">
              <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Latest download</div>
              <div style="font-size:18px; font-weight:600; color:#1a73e8;">{{ formatSpeedMetric(displayDownloadMbps !== null ? displayDownloadMbps : 'N/A') }}</div>
            </div>
            <div style="padding:8px; border:1px solid #f0f2f5; border-radius:6px; background:#fafbfd;">
              <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Latest upload</div>
              <div style="font-size:18px; font-weight:600; color:#34a853;">{{ formatSpeedMetric(displayUploadMbps !== null ? displayUploadMbps : 'N/A') }}</div>
            </div>
            <div style="padding:8px; border:1px solid #f0f2f5; border-radius:6px; background:#fafbfd;">
              <div style="font-size:10px; color:#8896af; text-transform:uppercase; letter-spacing:0.5px;">Last success</div>
              <div style="font-size:13px; font-weight:500; color:#334;">
                {{ showSyntheticSpeedtest ? formatRelativeTimestamp(metrics.speedtestUpdated) : (hasFallbackSpeedData ? 'Live telemetry' : 'N/A') }}
              </div>
            </div>
          </div>
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
  anomalyRate: 'N/A',
  speedtestDown: 'N/A',
  speedtestUp: 'N/A',
  speedtestUpdated: 'N/A'
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
const isBrowser = typeof window !== 'undefined';
const readNumberSetting = (key: string, fallback: number) => {
  if (!isBrowser) return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
};

const computeAxisRange = (series: Array<[number, number]>, paddingFraction: number, fallback: { min: number; max: number }, options: { includeZero?: boolean; minSpan?: number } = {}) => {
  const values = series.map(([, v]) => Number(v)).filter((v) => Number.isFinite(v));
  if (values.length === 0) return fallback;

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;

  if (min === max) {
    const magnitude = Math.abs(min) || Math.abs(fallback.max - fallback.min) || 1;
    const pad = Math.max(magnitude * paddingFraction, magnitude * 0.1, options.minSpan ?? 0.01);
    const lower = options.includeZero ? Math.min(0, min - pad) : min - pad;
    const upper = options.includeZero ? Math.max(0, max + pad) : max + pad;
    return { min: lower, max: upper };
  }

  let span = max - min;
  const pad = span > 0 ? span * paddingFraction : Math.max(Math.abs(min), Math.abs(max)) * paddingFraction;
  const safePad = Math.max(pad, options.minSpan ?? 0.01);
  let lower = min - safePad;
  let upper = max + safePad;

  if (options.includeZero) {
    lower = Math.min(0, lower);
    upper = Math.max(0, upper);
    if (upper - lower < span + safePad) {
      upper = Math.max(0, max + safePad);
      lower = Math.min(0, min - safePad);
    }
  }

  return { min: lower, max: upper };
};

// Initialize rangeSeconds from localStorage, default to 1 hour
const storedRange = isBrowser ? window.localStorage.getItem('starlink_rangeSeconds') : null;
const defaultRangeSeconds = storedRange ? Number(storedRange) : 3600;
const rangeSeconds = ref<number>((Number.isFinite(defaultRangeSeconds) && defaultRangeSeconds > 0) ? defaultRangeSeconds : 3600);
const rangeShiftMinutes = ref<number>(readNumberSetting('starlink_range_shift_minutes', 0));
const loggingIntervalSeconds = ref<number>(readNumberSetting('starlink_logging_interval_seconds', 60));

const rangeLabel = computed(() => (
  rangeSeconds.value === 600 ? '10 min' :
  rangeSeconds.value === 3600 ? '1 hour' :
  rangeSeconds.value === 10800 ? '3 hours' :
  rangeSeconds.value === 21600 ? '6 hours' :
  rangeSeconds.value === 43200 ? '12 hours' : `${Math.round(rangeSeconds.value/3600)} hours`
));
const showLossDetails = ref(false);
const showSettings = ref(false);
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

const speedtestServerOptions = [
  { label: 'Cardinal Photo (Los Angeles, US)', value: 'cardinalphoto.com' },
  { label: 'EENet (Tallinn, Estonia)', value: 'iperf.eenet.ee' },
  { label: 'Bouygues Telecom (Paris, France)', value: 'iperf.bouygues.net' },
  { label: 'Serverius (Amsterdam, NL)', value: 'speedtest.serverius.net' },
  { label: 'Leaseweb (Frankfurt, DE)', value: 'iperf.frankfurt.linode.com' },
  { label: 'HE.NET (Fremont, US)', value: 'iperf.he.net' },
  { label: 'Online.net (Paris, FR) – port 5202', value: 'ping.online.net:5202' }
];

const storedSpeedtestServer = isBrowser ? window.localStorage.getItem('starlink_speedtest_server') : null;
const speedtestSettings = ref<{ server: string; intervalMinutes: number }>({
  server: storedSpeedtestServer && speedtestServerOptions.some((opt) => opt.value === storedSpeedtestServer)
    ? storedSpeedtestServer
    : speedtestServerOptions[0].value,
  intervalMinutes: readNumberSetting('starlink_speedtest_interval_minutes', 15)
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
  if (!Number.isFinite(num)) return typeof value === 'string' ? value : String(value ?? '');
  const abs = Math.abs(num);
  if (abs >= 100) return num.toFixed(0);
  if (abs >= 1) return num.toFixed(2);
  if (abs >= 0.01) return num.toFixed(3);
  return num.toExponential(2);
};

function formatSpeedMetric(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value !== 'number' && typeof value !== 'string') return 'N/A';
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  if (Math.abs(num) >= 100) return `${num.toFixed(0)} Mbps`;
  if (Math.abs(num) >= 10) return `${num.toFixed(1)} Mbps`;
  return `${num.toFixed(2)} Mbps`;
}

function formatMegabytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (!Number.isFinite(value)) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  if (abs >= 10) return `${value.toFixed(1)} MB`;
  return `${value.toFixed(2)} MB`;
}

function formatRelativeTimestamp(value: number | string): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  const diffMs = Date.now() - num;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = minutes % 60;
    return rem ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function formatLocalTimeShort(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(ts));
}

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

async function fetchInstantProm(query: string, evalTime?: number): Promise<number | 'N/A'> {
  try {
    const params: Record<string, any> = { query };
    if (typeof evalTime === 'number') params.time = evalTime;
    const res = await axios.get(`/api/promql`, { params });
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
    const secondsSafe = Number.isFinite(seconds) && seconds > 0 ? seconds : 600;
    const stepSafe = Number.isFinite(step) && step > 0 ? step : 60;
    const end = (typeof fixedEnd === 'number' && Number.isFinite(fixedEnd))
      ? fixedEnd
      : Math.floor((Date.now() - (rangeShiftMinutes.value * 60 * 1000)) / 1000);
    const start = end - secondsSafe;
    const res = await axios.get(`/api/promql`, { params: { query, start, end, step: stepSafe } });
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
  
  return {
    mbDown: Number(rawDown.toFixed(2)),
    mbUp: Number(rawUp.toFixed(2))
  };
}

async function enrichVisibleRunsWithMb() {
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
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
      const fmt = new Intl.DateTimeFormat(undefined, {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
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

  const nowMs = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const fixedEnd = Math.floor(nowMs / 1000);
  const secondsRaw = Number(rangeSeconds.value);
  const seconds = Number.isFinite(secondsRaw) && secondsRaw > 0 ? secondsRaw : 3600;
  const stepRaw = Math.floor(seconds / 60);
  const step = Number.isFinite(stepRaw) && stepRaw > 0 ? Math.max(10, stepRaw) : 60;

  const downRateExpr = '(clamp_min(starlink_dish_downlink_throughput_bps_avg_10s / 1e6, 0)) or starlink_down_mbps';
  const upRateExpr = '(clamp_min(starlink_dish_uplink_throughput_bps_avg_10s / 1e6, 0)) or starlink_up_mbps';

  const q = {
    latency: 'starlink_latency_ms',
    packetLoss: 'starlink_packet_loss_pct',
    bandwidthDown: downRateExpr,
    bandwidthUp: upRateExpr
  } as const;

  const [lat, pl, dMbps, uMbps] = await Promise.all([
    fetchInstantProm(q.latency, fixedEnd),
    fetchInstantProm(q.packetLoss, fixedEnd),
    fetchInstantProm(q.bandwidthDown, fixedEnd),
    fetchInstantProm(q.bandwidthUp, fixedEnd)
  ]);
  metrics.value.latency = lat;
  metrics.value.packetLoss = pl;
  metrics.value.bandwidthDown = dMbps;
  metrics.value.bandwidthUp = uMbps;

  // Total download (GB) over last hour; assumes 15s scrape interval
  const totalGb = await fetchInstantProm('sum_over_time(starlink_down_mbps[1h]) * 15 / 8000', fixedEnd);
  totalDownGb.value = typeof totalGb === 'number' && Number.isFinite(totalGb) ? totalGb : 'N/A';

  // WiFi link speed (Mbps): windows_wifi_link_speed_mbps - connection speed between computer and Starlink router
  const wifi = await fetchInstantProm('windows_wifi_link_speed_mbps', fixedEnd);
  nicSpeedMbps.value = typeof wifi === 'number' && Number.isFinite(wifi) ? wifi : 'N/A';

  // GPS location
  const [gpsLat, gpsLon] = await Promise.all([
    fetchInstantProm('starlink_dish_gps_latitude', fixedEnd),
    fetchInstantProm('starlink_dish_gps_longitude', fixedEnd)
  ]);
  gpsLatitude.value = typeof gpsLat === 'number' && Number.isFinite(gpsLat) ? gpsLat : null;
  gpsLongitude.value = typeof gpsLon === 'number' && Number.isFinite(gpsLon) ? gpsLon : null;

  latencySeries.value = await fetchRangeProm(q.latency, seconds, step, fixedEnd);
  packetLossSeries.value = await fetchRangeProm(q.packetLoss, seconds, step, fixedEnd);
  const [down, up, ml, downMBm, upMBm, downMB10, upMB10, speedDownRange, speedUpRange] = await Promise.all([
    fetchRangeProm(downRateExpr, seconds, step, fixedEnd),
    fetchRangeProm(upRateExpr, seconds, step, fixedEnd),
    fetchRangeProm('starlink_micro_loss', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_downlink_throughput_bps_avg_10s[1m]) * 60 / 8000000', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_uplink_throughput_bps_avg_10s[1m]) * 60 / 8000000', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_downlink_throughput_bps_avg_10s[10m]) * 600 / 8000000', seconds, step, fixedEnd),
    fetchRangeProm('avg_over_time(starlink_dish_uplink_throughput_bps_avg_10s[10m]) * 600 / 8000000', seconds, step, fixedEnd),
    fetchRangeProm('starlink_speedtest_download_mbps', seconds, step, fixedEnd),
    fetchRangeProm('starlink_speedtest_upload_mbps', seconds, step, fixedEnd)
  ]);
  bandwidthDownSeries.value = down;
  bandwidthUpSeries.value = up;
  microLossSeries.value = ml;
  speedtestDownSeries.value = speedDownRange;
  speedtestUpSeries.value = speedUpRange;

  // Clamp MB/min and MB/10m to reduce unrealistic spikes from transient exporter outliers
  // Hard cap: Starlink max theoretical is ~300 Mbps = ~37.5 MB/s = ~2250 MB/min, so cap at 3000 MB/min for safety
  // Use 95th percentile (more aggressive) with 1.3x factor to catch outliers
  downMbPerMinSeries.value = clampSeriesPercentile(downMBm, 0.95, 1.3, 3000);
  upMbPerMinSeries.value = clampSeriesPercentile(upMBm, 0.95, 1.3, 3000);
  downMbPer10MinSeries.value = clampSeriesPercentile(downMB10, 0.95, 1.3, 30000);
  upMbPer10MinSeries.value = clampSeriesPercentile(upMB10, 0.95, 1.3, 30000);

  await loadStarlinkAnomalyScore(seconds, step);

  // Diagnostic charts
  const [azimuth, elevation, firstSlot] = await Promise.all([
    fetchRangeProm('starlink_dish_bore_sight_azimuth_deg', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_bore_sight_elevation_deg', seconds, step, fixedEnd),
    fetchRangeProm('starlink_dish_first_nonempty_slot_seconds', seconds, step, fixedEnd)
  ]);
  azimuthSeries.value = azimuth;
  elevationSeries.value = elevation;
  firstSlotSeries.value = firstSlot;

  // Flags
  const [spike, microLoss, outage, obstruction] = await Promise.all([
    fetchInstantProm('starlink_latency_spike', fixedEnd),
    fetchInstantProm('starlink_micro_loss', fixedEnd),
    fetchInstantProm('starlink_outage_active', fixedEnd),
    fetchInstantProm('starlink_obstruction_present', fixedEnd)
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

async function loadStarlinkAnomalyScore(seconds: number, step: number) {
  try {
    const pointsGuess = Math.max(120, Math.min(1800, Math.ceil(seconds / Math.max(step, 10))));
    const res = await axios.get('/api/starlink-anomalies', {
      params: {
        seconds,
        points: pointsGuess,
        threshold: 3.5,
        window: Math.max(20, Math.floor(pointsGuess * 0.1)),
      }
    });
    const data = res.data ?? {};
    const score = data?.score ?? {};
    if (Array.isArray(score.timestamps) && Array.isArray(score.values)) {
      anomalySeries.value = score.timestamps.map((ts: number, idx: number) => [ts, Number(score.values[idx] ?? 0)]);
    } else {
      anomalySeries.value = [];
    }
    if (Array.isArray(data?.events)) {
      starlinkAnomalyEvents.value = data.events.map((event: any) => ({
        metric: event.metric || 'metric',
        timestamp: Number(event.timestamp ?? 0),
        iso: typeof event.iso === 'string' ? event.iso : new Date(Number(event.timestamp ?? 0)).toISOString(),
        value: Number(event.value ?? 0),
        zscore: Number(event.zscore ?? 0)
      }));
    } else {
      starlinkAnomalyEvents.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch starlink anomalies', err);
    anomalySeries.value = [];
    starlinkAnomalyEvents.value = [];
  }
}

async function loadStarlinkEvents(seconds: number, step: number, fixedEnd: number) {
  const events: Array<{ time: string; timestamp: number; message: string; icon: string; color: string }> = [];
  
  try {
    // Fetch metrics for smart event detection
    const [downThroughputBits, upThroughputBits, obstructionFraction, packetLoss, latency] = await Promise.all([
      fetchRangeProm('starlink_dish_downlink_throughput_bps_avg_10s', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_uplink_throughput_bps_avg_10s', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_fraction_obstruction_ratio', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_pop_ping_drop_ratio', seconds, step, fixedEnd),
      fetchRangeProm('starlink_dish_pop_ping_latency_seconds', seconds, step, fixedEnd)
    ]);
    
    const toBytesPerSecond = (series: Array<[number, number]>) => series.map(([ts, val]) => [ts, val / 8] as [number, number]);
    const downThroughput = toBytesPerSecond(downThroughputBits);
    const upThroughput = toBytesPerSecond(upThroughputBits);
    
    let inSkySearch = false;
    let inObstruction = false;
    let inNetworkIssue = false;
    let skySearchStart = 0;
    let obstructionStart = 0;
    let networkIssueStart = 0;
    
    const formatTime = (ts: number) => new Intl.DateTimeFormat(undefined, {
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

function closeSettings() {
  showSettings.value = false;
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
const speedtestDownSeries = ref<Array<[number, number]>>([]);
const speedtestUpSeries = ref<Array<[number, number]>>([]);
const benchRuns = ref<Array<{ task: string; start: number; end: number }>>([]);
const anomalySeries = ref<Array<[number, number]>>([]);
const starlinkAnomalyEvents = ref<Array<{ metric: string; timestamp: number; iso: string; value: number; zscore: number }>>([]);
const starlinkEvents = ref<Array<{ time: string; timestamp: number; message: string; icon: string; color: string }>>([]);

// Diagnostic charts series
const azimuthSeries = ref<Array<[number, number]>>([]);
const elevationSeries = ref<Array<[number, number]>>([]);
const firstSlotSeries = ref<Array<[number, number]>>([]);


const hasLatencyData = computed(() => latencySeries.value.length > 0 || packetLossSeries.value.length > 0);
const hasBandwidthData = computed(() => bandwidthDownSeries.value.length > 0 || bandwidthUpSeries.value.length > 0 || microLossSeries.value.length > 0 || downMbPerMinSeries.value.length > 0 || upMbPerMinSeries.value.length > 0 || downMbPer10MinSeries.value.length > 0 || upMbPer10MinSeries.value.length > 0);
const hasAnomalyData = computed(() => anomalySeries.value.length > 0);
const hasSpeedtestData = computed(() => speedtestDownSeries.value.length > 0 || speedtestUpSeries.value.length > 0);
const hasFallbackSpeedData = computed(() => bandwidthDownSeries.value.length > 0 || bandwidthUpSeries.value.length > 0);
const syntheticLastSuccess = computed<number | null>(() => {
  const raw = metrics.value.speedtestUpdated;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
});
const syntheticIsFresh = computed(() => {
  const ts = syntheticLastSuccess.value;
  if (!ts) return false;
  const ageMinutes = (Date.now() - ts) / 60000;
  const cadence = Math.max(speedtestSettings.value.intervalMinutes || 0, 5);
  const allowable = Math.max(cadence * 2, 30); // permit up to twice cadence or 30 minutes whichever larger
  return ageMinutes <= allowable;
});
const syntheticDownInstant = computed(() => {
  const raw = metrics.value.speedtestDown;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
});
const syntheticUpInstant = computed(() => {
  const raw = metrics.value.speedtestUp;
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
});
const showSyntheticSpeedtest = computed(() => (
  speedtestDownSeries.value.length > 0 &&
  speedtestUpSeries.value.length > 0 &&
  syntheticIsFresh.value &&
  syntheticDownInstant.value !== null &&
  syntheticUpInstant.value !== null
));
const speedtestServerLabel = computed(() => {
  const match = speedtestServerOptions.find((opt) => opt.value === speedtestSettings.value.server);
  return match ? match.label : speedtestSettings.value.server;
});
const speedtestCadenceLabel = computed(() => {
  const minutes = speedtestSettings.value.intervalMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) return 'N/A';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
});

const latestFromSeries = (series: Array<[number, number]>) => {
  if (!Array.isArray(series) || series.length === 0) return null;
  const [, value] = series[series.length - 1];
  return Number.isFinite(value) ? value : null;
};

const displayDownloadMbps = computed<number | null>(() => {
  if (showSyntheticSpeedtest.value && syntheticDownInstant.value !== null) return syntheticDownInstant.value;
  const fallback = latestFromSeries(bandwidthDownSeries.value);
  return fallback !== null ? fallback : null;
});

const displayUploadMbps = computed<number | null>(() => {
  if (showSyntheticSpeedtest.value && syntheticUpInstant.value !== null) return syntheticUpInstant.value;
  const fallback = latestFromSeries(bandwidthUpSeries.value);
  return fallback !== null ? fallback : null;
});

const fallbackDownInstant = computed<number | null>(() => latestFromSeries(bandwidthDownSeries.value));
const fallbackUpInstant = computed<number | null>(() => latestFromSeries(bandwidthUpSeries.value));
const fallbackDownMbPerMin = computed<number | null>(() => latestFromSeries(downMbPerMinSeries.value));
const fallbackUpMbPerMin = computed<number | null>(() => latestFromSeries(upMbPerMinSeries.value));
const fallbackDownMbPer10m = computed<number | null>(() => latestFromSeries(downMbPer10MinSeries.value));
const fallbackUpMbPer10m = computed<number | null>(() => latestFromSeries(upMbPer10MinSeries.value));

const latencySeriesProcessed = computed(() => {
  const original = latencySeries.value;
  if (!Array.isArray(original) || original.length === 0) {
    return { points: [] as Array<[number, number | null]>, gaps: [] as Array<[number, number]> };
  }

  const diffs: number[] = [];
  for (let i = 0; i < original.length - 1; i += 1) {
    const diff = original[i + 1][0] - original[i][0];
    if (Number.isFinite(diff) && diff > 0) {
      diffs.push(diff);
    }
  }

  diffs.sort((a, b) => a - b);
  const medianIdx = diffs.length > 0 ? Math.floor(diffs.length / 2) : 0;
  const typicalStepMs = diffs.length > 0 ? diffs[medianIdx] : 10_000;
  const gapThreshold = Math.max(typicalStepMs * 2.5, 30_000);

  const processed: Array<[number, number | null]> = [[original[0][0], original[0][1]]];
  const gaps: Array<[number, number]> = [];

  for (let i = 0; i < original.length - 1; i += 1) {
    const current = original[i];
    const next = original[i + 1];
    const diff = next[0] - current[0];

    if (diff > gapThreshold) {
      const padding = Math.min(typicalStepMs, diff / 4);
      const gapStart = current[0] + padding;
      const gapEnd = next[0] - padding;
      if (gapEnd > gapStart) {
        gaps.push([gapStart, gapEnd]);
        processed.push([gapStart, null]);
        processed.push([gapEnd, null]);
      } else {
        gaps.push([current[0], next[0]]);
        processed.push([current[0] + 1, null]);
        processed.push([next[0] - 1, null]);
      }
    }

    processed.push([next[0], next[1]]);
  }

  return { points: processed, gaps };
});

const latencyOption = computed(() => {
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const windowStart = now - (rangeSeconds.value * 1000);
  const markLineData: any[] = benchRuns.value
    .filter(run => run.end >= windowStart && run.start <= now)
    .flatMap(run => {
      const dMb = typeof (run as any).mbDown === 'number' ? Math.trunc((run as any).mbDown) : undefined;
      const uMb = typeof (run as any).mbUp === 'number' ? Math.trunc((run as any).mbUp) : undefined;
      const startItem: any = { name: `${run.task} ▶\n${new Intl.DateTimeFormat(undefined, {
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(run.start))}\n↓${dMb ?? '?'}MB ↑${uMb ?? '?'}MB`, xAxis: run.start, lineStyle: { color: '#0a7', width: 2 }, task: run.task, mbDown: dMb, mbUp: uMb, label: { show: false } };
      const endItem: any = { 
        name: `${run.task} ◼\n${new Intl.DateTimeFormat(undefined, {
          hour: '2-digit', minute: '2-digit', hour12: false
        }).format(new Date(run.start))} - ${new Intl.DateTimeFormat(undefined, {
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

  const packetLossRange = computeAxisRange(packetLossSeries.value, 0.25, { min: 0, max: 5 }, { includeZero: true, minSpan: 0.2 });

  return {
    tooltip: { trigger: 'axis', valueFormatter: formatTooltipValue },
    grid: { left: 40, right: 80, top: 64, bottom: 40 },
    legend: { top: 6, data: ['Latency', 'Packet Loss (%)'] },
    xAxis: { 
      type: 'time',
      axisLabel: {
        formatter: (value: number | string) => {
          const ts = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(ts)) return '';
          return new Intl.DateTimeFormat(undefined, {
            hour: '2-digit', minute: '2-digit', hour12: false
          }).format(new Date(ts));
        }
      }
    },
    yAxis: [
      { type: 'value', name: 'ms' },
      { type: 'value', name: '%', position: 'right', min: packetLossRange.min, max: packetLossRange.max }
    ],
    series: [
      { 
        type: 'line', 
        name: 'Latency', 
        data: latencySeriesProcessed.value.points, 
        showSymbol: false, 
        smooth: true, 
        connectNulls: false,
        lineStyle: { width: 2 }, 
        yAxisIndex: 0,
        markArea: latencySeriesProcessed.value.gaps.length > 0 ? {
          silent: true,
          itemStyle: { color: 'rgba(220, 53, 69, 0.18)' },
          data: latencySeriesProcessed.value.gaps.map(([start, end]) => ([
            { xAxis: start },
            { xAxis: end }
          ]))
        } : undefined
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
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const windowStart = now - (rangeSeconds.value * 1000);
  const markLineData: any[] = benchRuns.value
    .filter(run => run.end >= windowStart && run.start <= now)
    .flatMap(run => {
      const dMb = typeof (run as any).mbDown === 'number' ? Math.trunc((run as any).mbDown) : undefined;
      const uMb = typeof (run as any).mbUp === 'number' ? Math.trunc((run as any).mbUp) : undefined;
      const formatTime = (ts: number) => new Intl.DateTimeFormat(undefined, {
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
  const storedLegend = isBrowser ? window.localStorage.getItem('starlink_bandwidthLegend') : null;
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
      data: ['Down (Mbps)', 'Up (Mbps)', 'Down (MB/min)', 'Up (MB/min)', 'Down (MB/10m)', 'Up (MB/10m)', 'Micro-loss (%)'],
      selected: legendSelected
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number | string) => {
          const ts = typeof value === 'number' ? value : Number(value);
          if (!Number.isFinite(ts)) return '';
          return new Intl.DateTimeFormat(undefined, {
            hour: '2-digit', minute: '2-digit', hour12: false
          }).format(new Date(ts));
        }
      }
    },
    yAxis: [
      { type: 'value', name: 'Mbps' },
      { type: 'value', name: 'MB/min', position: 'right', offset: 0 },
      (() => {
        const microLossRange = computeAxisRange(microLossSeries.value, 0.25, { min: 0, max: 100 }, { includeZero: true, minSpan: 5 });
        return { type: 'value', name: '%', position: 'right', offset: 48, min: microLossRange.min, max: microLossRange.max };
      })()
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
      { type: 'line', name: 'Micro-loss (%)', data: microLossSeries.value, showSymbol: false, yAxisIndex: 2, lineStyle: { type: 'dashed', width: 2 } },
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
  const anomalyMarks = starlinkAnomalyEvents.value.map((event) => ({
    name: `${event.metric.toUpperCase()}`,
    xAxis: event.timestamp,
    lineStyle: { color: '#d7263d', width: 2, type: 'dashed' },
    label: {
      show: true,
      formatter: () => `${event.metric.toUpperCase()} z=${event.zscore.toFixed(1)}\n${formatLocalTimeShort(event.timestamp)}`,
      fontSize: 10
    }
  }));

  const heuristicMarks = starlinkEvents.value.map(event => ({
    name: event.message,
    xAxis: event.timestamp,
    lineStyle: { color: event.color, width: 2, type: 'dashed' },
    label: {
      show: true,
      formatter: () => `${event.icon} ${event.message}\n${formatLocalTimeShort(event.timestamp)}`,
      fontSize: 10
    }
  }));

  const eventMarkLines = [...anomalyMarks, ...heuristicMarks];

  return {
    tooltip: { trigger: 'axis', valueFormatter: formatTooltipValue },
    grid: { left: 40, right: 80, top: 48, bottom: 24 },
    legend: { top: 4, data: ['Anomaly Score'] },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#667' },
      axisLine: { lineStyle: { color: '#d2d7e5' } },
      axisTick: { lineStyle: { color: '#d2d7e5' } }
    },
    yAxis: {
      type: 'value',
      name: 'Anomaly Score',
      nameLocation: 'middle',
      nameGap: 45,
      min: 0,
      max: 100
    },
    series: [
      { type: 'line', name: 'Anomaly Score', data: anomalySeries.value, showSymbol: false, lineStyle: { width: 1.5 } }
    ],
    markLine: eventMarkLines.length > 0 ? {
      data: eventMarkLines.map(line => [{ xAxis: line.xAxis, lineStyle: line.lineStyle, label: line.label, name: line.name }]),
      symbol: ['none', 'none']
    } : undefined
  };
});

const speedtestOption = computed(() => {
  const downRange = computeAxisRange(speedtestDownSeries.value, 0.1, { min: 0, max: 200 }, { includeZero: true, minSpan: 1 });
  const upRange = computeAxisRange(speedtestUpSeries.value, 0.1, { min: 0, max: 200 }, { includeZero: true, minSpan: 1 });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 45, right: 70, top: 32, bottom: 28 },
    legend: { top: 4, data: ['Download (Mbps)', 'Upload (Mbps)'] },
    xAxis: { type: 'time' },
    yAxis: [
      { type: 'value', name: 'Download (Mbps)', min: downRange.min, max: downRange.max },
      { type: 'value', name: 'Upload (Mbps)', position: 'right', min: upRange.min, max: upRange.max }
    ],
    series: [
      { type: 'line', name: 'Download (Mbps)', data: speedtestDownSeries.value, showSymbol: false, smooth: true, yAxisIndex: 0, lineStyle: { width: 1.8, color: '#1a73e8' } },
      { type: 'line', name: 'Upload (Mbps)', data: speedtestUpSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.8, color: '#34a853' } }
    ]
  };
});

const speedtestFallbackOption = computed(() => {
  const downRange = computeAxisRange(bandwidthDownSeries.value, 0.15, { min: 0, max: 100 }, { includeZero: true, minSpan: 0.5 });
  const upRange = computeAxisRange(bandwidthUpSeries.value, 0.15, { min: 0, max: 100 }, { includeZero: true, minSpan: 0.5 });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 45, right: 70, top: 32, bottom: 28 },
    legend: { top: 4, data: ['Starlink Down (Mbps)', 'Starlink Up (Mbps)'] },
    xAxis: { type: 'time' },
    yAxis: [
      { type: 'value', name: 'Down (Mbps)', min: downRange.min, max: downRange.max },
      { type: 'value', name: 'Up (Mbps)', position: 'right', min: upRange.min, max: upRange.max }
    ],
    series: [
      { type: 'line', name: 'Starlink Down (Mbps)', data: bandwidthDownSeries.value, showSymbol: false, smooth: true, yAxisIndex: 0, lineStyle: { width: 1.8, color: '#1a73e8' } },
      { type: 'line', name: 'Starlink Up (Mbps)', data: bandwidthUpSeries.value, showSymbol: false, smooth: true, yAxisIndex: 1, lineStyle: { width: 1.8, color: '#34a853' } }
    ]
  };
});

// Diagnostic chart options remaining
const azimuthOption = computed(() => {
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const windowStart = now - (rangeSeconds.value * 1000);
  const data = azimuthSeries.value.filter(([t]) => t >= windowStart);
  const range = computeAxisRange(data, 0.05, { min: 0, max: 360 }, { includeZero: false, minSpan: 0.05 });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'deg', min: range.min, max: range.max, scale: true },
    series: [{
      type: 'line',
      name: 'Azimuth',
      data,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#e74c3c' },
      areaStyle: { color: 'rgba(231, 76, 60, 0.1)' }
    }]
  };
});

const elevationOption = computed(() => {
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const windowStart = now - (rangeSeconds.value * 1000);
  const data = elevationSeries.value.filter(([t]) => t >= windowStart);
  const range = computeAxisRange(data, 0.05, { min: 0, max: 90 }, { includeZero: false, minSpan: 0.05 });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: { type: 'time', show: false },
    yAxis: { type: 'value', name: 'deg', min: range.min, max: range.max, scale: true },
    series: [{
      type: 'line',
      name: 'Elevation',
      data,
      showSymbol: false,
      smooth: true,
      lineStyle: { width: 1.5, color: '#16a085' },
      areaStyle: { color: 'rgba(22, 160, 133, 0.1)' }
    }]
  };
});

const firstSlotOption = computed(() => {
  const now = Date.now() - (rangeShiftMinutes.value * 60 * 1000);
  const windowStart = now - (rangeSeconds.value * 1000);
  const data = firstSlotSeries.value.filter(([t]) => t >= windowStart);
  const range = computeAxisRange(data, 0.1, { min: 0, max: 2 }, { includeZero: true, minSpan: 0.05 });
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, valueFormatter: formatTooltipValue },
    grid: { left: 35, right: 10, top: 5, bottom: 20 },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#667' },
      axisLine: { lineStyle: { color: '#d2d7e5' } },
      axisTick: { lineStyle: { color: '#d2d7e5' } }
    },
    yAxis: { type: 'value', name: 's', min: range.min, max: range.max, scale: true },
    series: [{
      type: 'line',
      name: 'First Slot',
      data,
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
  if (isBrowser && event && event.selected) {
    localStorage.setItem('starlink_bandwidthLegend', JSON.stringify(event.selected));
  }
}

// Watch rangeSeconds and save to localStorage
watch(rangeSeconds, (newVal) => {
  if (!isBrowser) return;
  let next = Number(newVal);
  if (!Number.isFinite(next) || next <= 0) next = 3600;
  if (next !== newVal) {
    rangeSeconds.value = next;
    return;
  }
  localStorage.setItem('starlink_rangeSeconds', String(next));
});

watch(rangeShiftMinutes, (val) => {
  if (isBrowser && Number.isFinite(val)) {
    localStorage.setItem('starlink_range_shift_minutes', String(val));
  }
  refreshAll();
});

watch(loggingIntervalSeconds, (val) => {
  if (isBrowser && typeof val === 'number' && Number.isFinite(val) && val > 0) {
    localStorage.setItem('starlink_logging_interval_seconds', String(val));
  }
});

watch(() => speedtestSettings.value.server, (val) => {
  if (!isBrowser) return;
  localStorage.setItem('starlink_speedtest_server', val);
  refreshAll();
});

watch(() => speedtestSettings.value.intervalMinutes, (val) => {
  if (!isBrowser) return;
  let next = val;
  if (!Number.isFinite(next) || next <= 0) next = 15;
  if (next < 5) next = 5;
  if (next !== val) {
    speedtestSettings.value.intervalMinutes = next;
    return;
  }
  localStorage.setItem('starlink_speedtest_interval_minutes', String(next));
});

onMounted(() => {
  refreshAll();
  loadBenchRuns();
  // Refresh benchmark overlays every 60s without reloading full series
  setInterval(() => { loadBenchRuns(); }, 60000);
});

if (isBrowser) {
  // Clean up legacy ThousandEyes settings persisted before the integration was removed.
  localStorage.removeItem('starlink_te_settings');
}
</script>

<script lang="ts">
export default {
  components: { 'v-chart': VChart }
}
</script>

<style>
html, body, #app { height: 100%; margin: 0; background: #f6f8fb; }
</style>

