# Fixes Applied - WiFi Link Speed & Latency Correlation

## Issue 1: WiFi Link Speed Not Showing ✅ FIXED

**Problem:** Dashboard was looking for `windows_wifi_link_speed_mbps` but the wifi exporter wasn't running.

**Solution:**
1. Fixed wifi exporter error handling in `scripts/wifi-exporter.mjs`
   - Added better error handling for PowerShell output
   - Added support for "bps" format (treats as 0/disconnected)
   - Improved JSON parsing robustness

2. Started wifi exporter:
   ```bash
   npm run restart:wifi
   ```

**Status:** ✅ WiFi exporter running on port 9818, metrics available at `http://127.0.0.1:9818/metrics`

## Issue 2: Latency Correlation Not Working ✅ FIXED

**Problem:** Dashboard calls `/api/ai-correlate` endpoint which is a Vercel serverless function, not available locally.

**Solution:**
1. Created `.env.local` with `PROM_URL=http://localhost:9090/api/v1`

2. Created local API server (`scripts/api-server.mjs`) that:
   - Serves API endpoints locally on port 3000
   - Proxies `/api/ai-correlate`, `/api/promql`, `/api/bench-runs`
   - Uses `.mjs` versions of API files for proper ES module support

3. Created `.mjs` copies of API files:
   - `api/ai-correlate.mjs`
   - `api/promql.mjs`
   - `api/bench-runs.mjs`

4. Added npm scripts:
   - `npm run start:api` - Start API server in foreground
   - `npm run start:api:bg` - Start API server in background

**Status:** ✅ API server running on port 3000, latency correlation endpoint working

## Usage

### Start services:
```bash
# Start wifi exporter
npm run restart:wifi

# Start API server (for latency correlation)
npm run start:api:bg

# Or start both together
npm run restart:stack
```

### Verify:
```bash
# Check WiFi metrics
curl http://127.0.0.1:9818/metrics

# Check latency correlation API
curl "http://localhost:3000/api/ai-correlate?seconds=900&step=10"
```

## Notes

- WiFi exporter requires Windows PowerShell access from WSL
- API server needs Prometheus running on port 9090
- Both services write logs to `logs/` directory
