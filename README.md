# Levante Performance

A performance throughput dashboard (Vue + React, TypeScript) for the Levante framework. The initial module focuses on Starlink connectivity metrics via Netdata.

- Vue app: `apps/vue-dashboard`
- React app: `apps/react-dashboard`
- API proxy: `api/netdata-proxy.js` (Vercel serverless function)
- PromQL proxy: `api/promql.js` (Grafana Cloud / Prometheus)

## Quick start

- Install dependencies (workspace):

```bash
npm install
```

- Build both dashboards and prepare static output for Vercel:

```bash
npm run build
```

- Local preview of built static assets:

```bash
npm run preview
```

- Development:

```bash
npm run dev:vue
npm run dev:react
```

## Netdata (Agent and Cloud)

Set one of the following environment variables (priority in order):

- `NETDATA_URL` (recommended for remote/cloud): full base URL to a reachable Netdata agent or reverse proxy, e.g. `https://netdata.example.com` or `https://proxy.example.com/netdata`.
- `NETDATA_HOST` (simple local/dev): hostname/IP without protocol; default port 19999 assumed, e.g. `localhost` or `192.168.1.50`.

Optional auth headers for protected endpoints:

- `NETDATA_AUTH_BASIC`: `base64(username:password)` for Basic auth.
- `NETDATA_BEARER`: `token` string for Bearer auth.

The Vercel function `/api/netdata` will forward to `${NETDATA_URL}/api/v1/data?...` when `NETDATA_URL` is set, otherwise to `http://NETDATA_HOST:19999/api/v1/data?...`.

Examples:

```bash
# Local dev hitting local agent
NETDATA_HOST=localhost npm run dev:vue

# Local dev hitting reverse-proxied remote agent
NETDATA_URL=https://netdata.example.com npm run dev:react

# With basic auth (username:password -> base64)
NETDATA_URL=https://netdata.example.com NETDATA_AUTH_BASIC=$(printf 'user:pass' | base64 -w0) npm run dev:vue
```

## Grafana Cloud / Prometheus (PromQL)

Set `PROM_URL` to your Prometheus-compatible API base (ending in `/api/v1`), plus an auth method:

- `PROM_URL`: e.g. `https://prometheus-prod-10-prod-us-central-0.grafana.net/api/v1`
- Auth (choose one):
  - `PROM_BASIC`: base64 of `username:token`
  - `PROM_USER` + `PROM_TOKEN`: will be converted to Basic automatically
  - `PROM_BEARER`: bearer token

Example queries:

- Instant: `/api/promql?query=up{job="starlink"}`
- Range: `/api/promql?query=avg_over_time(starlink_latency_ms[5m])&start=1734489600&end=1734493200&step=30`

Use this for fully cloud-hosted metrics and add PromQL-backed components in the UI as needed.

## Deployment (Vercel)

- Repo root contains `vercel.json` that serves static files from `public/` and exposes `/api/netdata` and `/api/promql`.
- The root build script emits each app into `public/vue/` and `public/react/`.
- Default route `/` points to `public/vue/index.html`. React app is at `/react`.
- Set `NETDATA_URL`/`NETDATA_HOST` and/or `PROM_URL` (+ auth) in Vercel Project Settings → Environment Variables.
