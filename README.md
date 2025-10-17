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

## Netdata

Set `NETDATA_HOST` (hostname or IP, no protocol, default port 19999 assumed) as an environment variable in Vercel or your local env. Requests to `/api/netdata` will be proxied to `http://NETDATA_HOST:19999`.

Example:

```bash
NETDATA_HOST=192.168.1.50 npm run dev:vue
```

## Deployment (Vercel)

- Repo root contains `vercel.json` that serves static files from `public/` and exposes `/api/netdata`.
- The root build script emits each app into `public/vue/` and `public/react/`.
- Default route `/` points to `public/vue/index.html`. React app is at `/react`.
