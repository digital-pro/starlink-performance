# Vercel Environment Variables Setup

## 📋 Quick Setup Instructions

Go to: https://vercel.com/digitalpros-projects/starlink-performance/settings/environment-variables

Add these environment variables:

---

### 1. PROM_URL (required)

**Value:** your Grafana Cloud Prometheus endpoint (e.g. `https://prometheus-prod-xx.grafana.net/api/v1`)

---

### 2. Authentication for Prometheus (choose one set)

- `PROM_BASIC`: `base64(username:token)`
- or `PROM_USER` and `PROM_TOKEN`
- or `PROM_BEARER`

---

### 3. Optional Dash Integrations

| Variable | Purpose |
|----------|---------|
| `NETDATA_URL` / `NETDATA_HOST` | Enable Netdata proxy endpoints |
| `NETDATA_AUTH_BASIC` / `NETDATA_BEARER` | Netdata auth options |
| `VERCEL_ALIAS` | Alias applied by `npm run deploy` |
| `VERCEL_BYPASS_TOKEN` | Required only if deployment protection is enabled |

---

## 📦 Benchmark Storage

Benchmark uploads are now persisted in Vercel Blob storage. No Google Cloud project or service account variables are required. The `/api/bench-push` function writes to Blob directly via `@vercel/blob`, and `/api/bench-runs` reads the same data.

---

## ✅ After Adding Variables

1. Save each variable
2. Deploy with `npm run deploy`
3. Test the API:
   - Upload: `POST https://starlink-performance.vercel.app/api/bench-push`
   - Read: `GET https://starlink-performance.vercel.app/api/bench-runs`

---

## 🧪 Test Benchmark Upload

```bash
curl -X POST https://starlink-performance.vercel.app/api/bench-push \
  -H "Content-Type: application/json" \
  -d '[
    {
      "task": "test-task",
      "start": 1234567890000,
      "end": 1234567895000,
      "metadata": {"version": "1.0.0"}
    }
  ]'
```

Should return:
```json
{
  "ok": true,
  "count": 1,
  "stored": "benchmarks/1234567890000.json"
}
```

