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
export VERCEL_ALIAS=levante-performance-digitalpros-projects.vercel.app

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
  - Set `VERCEL_ALIAS` to your deployed hostname (e.g., `levante-performance.vercel.app` or your custom alias)
```bash
VERCEL_ALIAS=levante-performance.vercel.app npm run read:up | head -n1
VERCEL_ALIAS=levante-performance.vercel.app npm run read:series | head -n1
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
