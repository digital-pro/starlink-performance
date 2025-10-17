# Levante Performance

A performance throughput dashboard (Vue + React, TypeScript) for the Levante framework. The initial module focuses on Starlink connectivity metrics via Netdata.

- Vue app: `apps/vue-dashboard`
- React app: `apps/react-dashboard`
- API proxy: `api/netdata-proxy.js` (Vercel serverless function)

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

## Deployment (Vercel)

- Repo root contains `vercel.json` that serves static files from `public/` and exposes `/api/netdata`.
- The root build script emits each app into `public/vue/` and `public/react/`.
- Default route `/` points to `public/vue/index.html`. React app is at `/react`.
- Set one of `NETDATA_URL` or `NETDATA_HOST` in Vercel Project Settings → Environment Variables. Add `NETDATA_AUTH_BASIC` or `NETDATA_BEARER` if your Netdata is protected.
