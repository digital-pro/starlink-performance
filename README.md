# Starlink Performance

A cloud-hosted performance dashboard for Starlink, built with Vue + TypeScript and deployed on Vercel. The UI reads metrics from Grafana Cloud Prometheus via a secure serverless proxy.

- Frontend (Vue 3 + Vite): `apps/vue-dashboard`
- Serverless APIs (Vercel): `api/promql.js` (Prometheus proxy), `api/netdata-proxy.js` (optional Netdata proxy)
- Deployment helpers: `scripts/deploy.mjs`, `scripts/prepare-public.mjs`
- Prometheus remote_write helpers: `deployment/*`

---

## How it works

- The Vue app requests data from our own endpoint `GET /api/promql`.
- `api/promql.js` forwards the request to your Grafana Cloud Prometheus with the credentials you configure in Vercel.
- The UI shows four key panels and cards, all rounded to three decimals:
  - Down (Mbps): `avg_over_time(starlink_dish_downlink_throughput_bytes[1m]) * 8 / 1e6`
  - Up (Mbps): `avg_over_time(starlink_dish_uplink_throughput_bytes[1m]) * 8 / 1e6`
  - Latency (ms): `starlink_dish_pop_ping_latency_seconds * 1000`
  - Packet Loss (%): `starlink_dish_pop_ping_drop_ratio * 100`
- Header buttons:
  - “Open in Grafana” → your internal dashboard in Grafana Cloud (signed-in view)
  - “Public view” → your public dashboard URL (no login)

> Note: The app is now Prometheus-only. The Netdata proxy remains for optional/dev use but is not active in the UI.

---

## Dashboard Features

### Charts & Metrics
- **Bandwidth Chart** (240px height): Displays download/upload speeds (Mbps), MB/min, MB/10min, and micro-loss (%)
  - Crosshair tooltip shows all metric values at cursor position
  - Perfectly aligned timeline with other charts
- **Latency Chart** (180px height): Shows latency (ms) and packet loss (%) over time with benchmark run overlays
  - 50% taller than original for better visibility
- **Anomaly Detection & Starlink Events Chart** (120px height): Displays Netdata anomaly rate with event overlays
  - Smart event detection with baseline-relative analysis
  - Independent legend toggles for anomaly rate and events
  - Hover tooltips show event details and timestamps
- **Time Range Selector**: Choose 10 min, 1 hour, 3 hours, 6 hours, or 12 hours (persists in localStorage)
- **Legend Persistence**: Chart legend selections (show/hide metrics) are saved across page refreshes
- **X-Axis Format**: Time only (HH:MM) in 24-hour Pacific Time format
- **Timeline Alignment**: All three charts use identical grid spacing for vertical alignment
- **Data Resolution**: 30-second step size balances detail and performance (~1440 samples for 12-hour view)

### Correlation Indicators (Last 15m)
- **Latency↔Drops**: Correlation coefficient between latency and packet drops (-1 to +1). Hover for details.
- **Latency↔CPU**: Correlation between latency and CPU usage. Positive values suggest CPU load impacts performance.
- **15s Periodicity**: Autocorrelation analysis detects repeating ~15-second patterns in latency. Yellow (YES) indicates periodic spikes from scheduled processes, satellite beam switching, or regular interference. Gray (no) means random variations.

### Diagnostic Flags
Four real-time indicators for common Starlink issues:
- **Latency spike**: Short-term spike vs baseline
- **Micro-loss**: Sustained 1-2% packet loss (typical on Starlink)
- **Outage active**: Outage duration increasing
- **Obstruction**: Obstruction indicator > 0.2 over 5m

### Benchmark Overlays
- **Vertical markers** on charts show start (green ▶) and end (red ◼) times of Cypress benchmark runs
- **Labels** display task name and data transferred (e.g., "↓429MB ↑31MB")
- **Enhanced tooltips**: Hover over markers to see:
  - Task name
  - Data transferred (download/upload in MB)
  - Time range (start - end in HH:MM Pacific Time)
- **Auto-refresh**: Benchmark data refreshes every 60 seconds
- **Timestamps**: All times displayed in Pacific Time (24-hour format)
- **Accurate calculations**: Uses 10-second step size matching Prometheus scrape interval for precise byte counting

### Packet Loss Details Modal
Click "Packet loss details" button to see:
- Current loss percentage
- Max/Avg over 5m, 15m, and 1h windows
- Time with loss > 0% (15m)

### Smart Starlink Event Detection
The dashboard automatically detects and displays Starlink events by analyzing metric patterns with **baseline-relative detection**:

**Detection Algorithm:**
- Maintains a rolling 5-minute baseline of obstruction levels
- Checks every 10 minutes for significant changes
- Detects spikes (1.5x baseline), increases (+1.5% absolute), and high packet loss (>3%)
- Also detects state changes (sky search, recovery) from throughput patterns

**Event Types:**
- **🔴 Obstruction spike** - Obstruction 1.5x above recent baseline (e.g., "5.2% (baseline 3.8%)")
- **🟠 Obstruction increased** - Absolute increase of +1.5% or more
- **⚠️ High packet loss** - Packet loss exceeds 3%
- **🔍 Sky Search** - Both throughputs drop to near-zero (< 80 Kbps)
- **✅ Recovery** - Return to normal operation after degradation

**Display:**
- Events shown as color-coded vertical lines on the Anomaly Detection chart
- Hover over event markers (emoji icons) to see full message and timestamp
- Independent legend toggle for "Starlink Events" (separate from anomaly rate line)
- Provides similar visibility to the Starlink mobile app using only local metrics

---

## Prerequisites

- Node.js 18+
- A Grafana Cloud stack with Prometheus enabled
- Vercel account + Vercel CLI (the `deploy.mjs` uses the CLI under the hood)

---

## Install & run

```bash
# from repo root
npm install

# local dev (Vue dev server)
npm run dev:vue

# build all and stage static assets into ./public
npm run build

# preview the built site locally
npm run preview  # serves ./public on http://localhost:5175
```

---

## Configure Grafana Cloud access (for /api/promql)

Set these in Vercel → Project → Settings → Environment Variables (Production):

- `PROM_URL`: Your Prometheus API base. Any of these forms work; the proxy normalizes to `/api/v1`:
  - `https://<your-stack>.grafana.net/api/prom/api/v1` (recommended)
  - or `https://prometheus-prod-<region>.grafana.net/api/v1`
- Choose one auth method:
  - `PROM_BASIC`: base64 of `username:token`
  - or `PROM_USER` and `PROM_TOKEN` (the proxy will build Basic for you)
  - or `PROM_BEARER` (Bearer token)

Grafana Cloud specifics:
- For reads, create an Access Policy token with scope `metrics:read` and use your stack’s Instance ID as the username.
- For remote_write (optional), use scope `metrics:write`.

Quick verification (after variables are set and deployed):
- Health: `GET /api/ping` → `{ ok: true, now: ... }`
- PromQL instant: `GET /api/promql?query=up`
- PromQL range: `GET /api/promql?query=up&start=<unix>&end=<unix>&step=30`
- Series discovery: `GET /api/promql?endpoint=series&match[]=starlink_*`

---

## Deploy to Vercel

You can deploy from the command line (CI-friendly):

```bash
# optional: set a permanent alias for the production deployment
export VERCEL_ALIAS=starlink-performance-digitalpros-projects.vercel.app

# deploy (build → link → deploy → alias)
npm run deploy
```

What the script does:
- `npm run build` builds the Vue app and copies assets to `public/`.
- Links the directory to the Vercel project (idempotent).
- Creates a production deployment.
- If `VERCEL_ALIAS` is set, assigns the alias to the new deployment.

Vercel config:
- `vercel.json` sends `/api/*` to serverless functions.
- `/` and all other paths serve the static site from `public/`.

---

## Public Grafana dashboard

To make the Grafana dashboard viewable without login:
1) Open the dashboard in Grafana (signed in).
2) Share → Public dashboard → Enable → Select the panels to include → Generate link.
3) Copy the public URL and paste it into the Vue app button if you want it hard-coded:
   - Edit `apps/vue-dashboard/src/App.vue` → the anchor with text “Public view”.
4) Commit and redeploy (or keep the same URL if you don’t change it often).

Tips:
- Ensure every panel’s Data Source is your Grafana Cloud Prometheus (no “Default”, no “Mixed”).
- If you see “unsupported data source”, at least one panel points to an unsupported/variable source.
- Avoid using old shortlinks (`/goto/...`) for public sharing; use `/public-dashboards/...` links.

---

## Optional: Send metrics to Grafana Cloud via Prometheus remote_write

If your metrics originate from local Prometheus instances, use `deployment/` helpers.

- Files:
  - `deployment/prometheus-remote-write.yml`: snippet for `remote_write` and `external_labels`.
  - `deployment/generate-remote-write.sh`: fills in your stack and token.
  - `deployment/apply-remote-write.sh`: safe merge + optional restart.
  - `deployment/run-wsl-prom.sh`: convenience launcher for a lightweight Prometheus in WSL.

### Prometheus Configuration & Optimizations

**Scrape Interval**: `10 seconds` (configurable in `deployment/run-wsl-prom.sh`)
- Provides high-resolution data for accurate event detection
- Enables precise benchmark MB calculations (10s step matches scrape interval)
- Bandwidth impact: ~3x more data than 30s scraping, but filtered Netdata metrics keep it manageable

**Netdata Metric Filtering**: 
- Only scrapes `netdata_net_speed_*` and `netdata_anomaly_detection_*` metrics
- Reduces Netdata scrape size from ~649KB to ~5KB per scrape (~94% reduction)
- Configured via `metric_relabel_configs` in Prometheus config

**Dashboard Query Step**: `30 seconds`
- Balances data resolution with query performance
- Provides ~1440 samples for 12-hour view (vs ~61 with old dynamic step)
- Benchmark calculations use 10s step for accuracy

### Starlink Exporter

The dashboard uses the standard `danopstech/starlink_exporter` to collect metrics from the Starlink dish:

- **Metrics Collected**: Throughput, latency, packet loss, obstruction ratio, uptime, and more
- **gRPC API**: Communicates with dish at `192.168.100.1:9201` using `GetStatus` endpoint
- **Event Detection**: Since the local API doesn't expose event logs, the dashboard uses smart heuristic-based detection to infer events from metric patterns (see "Smart Starlink Event Detection" above)
- **Dashboard Integration**: The Anomaly Detection chart overlays detected events as mark lines

**Building from Source**:
```bash
cd /home/djc/starlink_exporter
# The exporter_history.go file is already added
go build -o /home/djc/levante/starlink-performance/logs/starlink_exporter ./cmd/starlink_exporter
npm run restart:exporter  # Restart with new binary
```

### WiFi Link Speed Exporter (WSL2)

The dashboard displays Windows WiFi adapter link speed via a custom Node.js exporter:

- **Script**: `scripts/wifi-exporter.mjs` - Queries Windows WiFi adapter via PowerShell and exposes `windows_wifi_link_speed_mbps` metric
- **Port**: 9818
- **Auto-start**: Included in `npm run restart:stack` and systemd service
- **Metric**: `windows_wifi_link_speed_mbps` - Current WiFi link speed in Mbps (e.g., 65, 866, 1200)

This is the **negotiated connection speed** between your WiFi adapter and router, not your internet speed. It adjusts dynamically based on signal quality and will be lower than your actual Starlink throughput.

Steps (example):
```bash
# save your write token (metrics:write) locally and keep it secret
printf 'glc_...' > secrets/grafana_write_token.txt

# generate a site-specific snippet
cd deployment
INSTANCE_ID=123456 SITE=starlink ./generate-remote-write.sh > remote-write.starlink.yml

# merge into your prometheus.yml and restart Prometheus
# (or use apply-remote-write.sh with --config /path/to/prometheus.yml)
```

Common pitfalls:
- 404 Not Found on remote_write → use Grafana Cloud endpoint `/api/prom/push` (not `/api/prom/api/v1/write`).
- 401 invalid scope → token must include `metrics:write` for remote_write.

---

## Environment variables (summary)

- `PROM_URL` (required): Grafana Cloud Prometheus API base.
- `PROM_BASIC` | `PROM_USER` + `PROM_TOKEN` | `PROM_BEARER`: auth for reads.
- `VERCEL_ALIAS` (optional): alias to assign after deploy.
- Netdata (optional/dev only):
  - `NETDATA_URL` or `NETDATA_HOST`
  - `NETDATA_AUTH_BASIC` or `NETDATA_BEARER`

Secrets convenience (gitignored):
- `secrets/grafana_env.txt` and `secrets/grafana_token.txt` are local-only helpers; configure the actual values in Vercel.

---

## Troubleshooting

- 404 on `/api/promql` in production:
  - Ensure `vercel.json` has the `/api/(.*)` rewrite before the SPA catch-all (already configured here).
- `{ "status":"error", "error":"authentication error: invalid token" }`:
  - Use a Grafana Cloud Access Policy token with `metrics:read` and correct instance ID username.
- Public dashboard shows “failed to load application files” or “unsupported data source”:
  - Bind every panel to your Cloud Prometheus data source; regenerate the public link; avoid `/goto/` links.
- Down/Up show empty values:
  - Starlink throughput is often a gauge; we use `avg_over_time(...[1m]) * 8 / 1e6`. Test via:
    - `/api/promql?query=avg_over_time(starlink_dish_downlink_throughput_bytes%5B1m%5D)*8/1e6`
- CDN/browser cache:
  - Hard refresh, use an incognito window, or append a cache-busting query string to the site URL.

Advanced metrics & diagnostics
- Recording rules (loaded by helper): `deployment/rules/starlink-kpis.yml`
  - `starlink_latency_ms`, `starlink_packet_loss_pct`, `starlink_down_mbps`, `starlink_up_mbps`
  - `starlink_latency_spike` (15s reconfiguration spikes), `starlink_micro_loss`, `starlink_outage_active`, `starlink_obstruction_present`
- Node exporter (optional): pass `--node <HOST:9100>` to `deployment/run-wsl-prom.sh` or set target in script; default is `127.0.0.1:9100`.
- Local diagnose utility:
```bash
npm run diagnose:starlink
# → prints a JSON summary of current latency, packet loss, throughput, and issue flags
```

Grafana dashboard import/update
- The advanced Starlink dashboard JSON lives at `deployment/grafana-dashboard-starlink.json`.
- To import/update it into your Grafana Cloud stack:
```bash
# once per machine: save a Grafana API token (Editor/Admin on the stack)
printf '<your_grafana_api_token>' > secrets/grafana_api_token.txt

# import/update the dashboard (replace with your stack host)
STACK_HOST=<your-stack>.grafana.net npm run grafana:import
```

---

## Repo layout

```
apps/vue-dashboard/       # Vue 3 dashboard app
api/promql.js             # Prometheus proxy (Grafana Cloud)
api/netdata-proxy.js      # Netdata proxy (optional)
scripts/deploy.mjs        # Build + deploy + alias
scripts/prepare-public.mjs# Copy built assets into ./public
public/                   # Static output served by Vercel
deployment/               # Remote write helpers for Prometheus → Grafana Cloud
```

---

## License

MIT (c) Levante Framework

---

## Operations & quick commands

These npm scripts help run and verify the full pipeline (Exporter → Prometheus → Grafana Cloud → Dashboard):

- Start Prometheus (WSL helper)
  - Requires: `INSTANCE_ID` env var (your Grafana Cloud stack instance ID)
  - Optional: `STARLINK_TARGET` like `10.0.0.5:9817` (defaults to `127.0.0.1:9817`)

```bash
INSTANCE_ID=2743807 npm run prom:start
```

- Stop Prometheus started by the helper
```bash
npm run prom:stop
```

- Tail Prometheus logs
```bash
npm run prom:logs
```

- Check Prometheus scrape targets
```bash
npm run prom:targets | jq .   # optional jq
```

- Check Starlink exporter endpoint
```bash
npm run exporter:check
# or with a remote host
STARLINK_TARGET=10.0.0.5:9817 npm run exporter:check
```

- Verify dashboard read-path (Vercel → Grafana Cloud)
  - Set `VERCEL_ALIAS` to your deployed hostname (e.g., `starlink-performance.vercel.app` or your custom alias)
```bash
VERCEL_ALIAS=starlink-performance.vercel.app npm run read:up | head -n1
VERCEL_ALIAS=starlink-performance.vercel.app npm run read:series | head -n1
```

- Auto-discover exporter and wire automatically (optional)
```bash
npm run ops:find-target   # scans local subnets for a starlink exporter on :9817
npm run ops:auto-wire     # finds, persists target, restarts Prometheus, verifies
```

- Auto-restart watchdog (optional but recommended)
  - Restarts the exporter and/or Prometheus automatically if either becomes unhealthy.
  - Writes logs to `logs/watchdog.out`; PID at `logs/watchdog.pid`.
```bash
npm run watchdog:start
npm run watchdog:stop
```

- Manual restarts
```bash
# Restart only the Starlink exporter
npm run restart:exporter

# Restart exporter and Prometheus stack
npm run restart:stack
```

Notes
- The helper uses `deployment/run-wsl-prom.sh`, which reads your write token from `secrets/grafana_write_token.txt` and writes config to `deployment/prom-wsl.yml`.
- Health endpoint: `GET /api/ping` now returns `{ ok: true, now: ... }` for quick checks.
- If your exporter isn’t on localhost, pass `STARLINK_TARGET` or update your Prometheus config accordingly.
 - Logs are written to `logs/` (gitignored). Use `npm run prom:logs` to tail Prometheus.
 - Prometheus TSDB data lives in `data/` (gitignored).
 - Legacy `deployment/.cache/` is no longer used and is gitignored.

Troubleshooting (recap)
- Empty panels or no data in Grafana Cloud usually means the exporter target is Down. Start the exporter or point Prometheus at the correct host.
- 404 on remote_write: ensure the write URL is `/api/prom/push` (see `deployment/prometheus-remote-write.yml`).
- Auth errors: use a Grafana Cloud Access Policy token with `metrics:read` (reads) and `metrics:write` (writes).
