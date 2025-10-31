# Starlink Performance - Configuration Guide

> **Update (Oct 2025):** Benchmark uploads now use Vercel Blob storage. The Google Cloud Storage setup below is retained for legacy reference and can be skipped for new deployments.

This guide walks you through setting up the complete monitoring and benchmarking system for Starlink Performance.

## Table of Contents
1. [Google Cloud Storage Setup](#google-cloud-storage-setup)
2. [Service Account Permissions](#service-account-permissions)
3. [Vercel Environment Variables](#vercel-environment-variables)
4. [Data Collection Options](#data-collection-options)
5. [Testing & Deployment](#testing--deployment)

---

## Google Cloud Storage Setup *(legacy)*

> These steps are only needed if you continue to use the historical Google Cloud bucket. New deployments can skip to the Vercel Blob guidance below.

### Overview
- **Bucket Name:** `starlink-performance-dev`
- **Project:** `hs-levante-admin-dev`
- **Service Account:** `levante-dashboard-writer-dev@hs-levante-admin-dev.iam.gserviceaccount.com`
- **Purpose:** Store benchmark data and performance metrics

### Step 1: Grant Service Account Permissions

1. Go to [Google Cloud Console - Storage](https://console.cloud.google.com/storage/browser)
2. Select your bucket: `starlink-performance-dev`
3. Click the **Permissions** tab
4. Click **Grant Access**
5. Add the service account with these roles:
   - Principal: `levante-dashboard-writer-dev@hs-levante-admin-dev.iam.gserviceaccount.com`
   - Roles needed:
     - **Storage Object Admin** (to read/write objects)
     - **Storage Admin** (to update bucket settings like CORS)

### Step 2: Make Bucket Publicly Readable (Optional)

If you want anyone to view benchmarks via direct URLs:

1. In the **Permissions** tab, click **Grant Access**
2. Principal: `allUsers`
3. Role: **Storage Object Viewer**
4. Click **Save**

⚠️ **Warning:** This makes all files in the bucket publicly accessible. Skip this if you want authenticated access only.

### Step 3: Remove Public Access Prevention (if needed)

If you see "Public access is prevented" warning:

1. Go to bucket details
2. Find **Public access prevention**
3. Change to **Not enforced** (if you want public reads)

### Step 4: Set CORS Configuration

After granting the service account **Storage Admin** role, run:

```bash
cd /home/david/levante/starlink-performance
gsutil cors set cors.json gs://starlink-performance-dev
```

Or set it manually in the Cloud Console:
1. Go to bucket details
2. Click **Configuration** tab
3. Under **CORS**, click **Edit CORS configuration**
4. Paste the contents from `cors.json`

### Step 5: Verify Setup

```bash
# Check bucket permissions
gsutil iam get gs://starlink-performance-dev

# Check CORS configuration
gsutil cors get gs://starlink-performance-dev

# Test file upload
echo "test" > test.txt
gsutil cp test.txt gs://starlink-performance-dev/
rm test.txt
```

---

## Service Account Permissions *(legacy)*

> Only required if you are still writing to Google Cloud Storage.

### Current Service Account
- **File Location:** `/home/david/levante/starlink-performance/secrets/levante-dashboard-dev-key.json`
- **Email:** `levante-dashboard-writer-dev@hs-levante-admin-dev.iam.gserviceaccount.com`
- **Project:** `hs-levante-admin-dev`

### ⚠️ Security Note
The service account key file is stored in the `secrets/` folder which is excluded from git via `.gitignore`. **Never commit service account keys to version control.**

### Using the Service Account

In your Node.js/Vercel API functions:

```javascript
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: 'hs-levante-admin-dev',
  credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
});

const bucket = storage.bucket('starlink-performance-dev');
```

---

## Benchmark Storage (current)

Benchmark uploads now use [Vercel Blob storage](https://vercel.com/docs/storage/vercel-blob). The serverless APIs (`api/bench-push.js` and `api/bench-runs.js`) read and write blobs under the `benchmarks/` prefix, so no external bucket or service account is required.

- `/api/bench-push` writes timestamped snapshots, `latest.json`, and `runs.json`
- `/api/bench-runs` serves the in-memory cache or, if empty, reads from Blob
- Local benchmark scripts just POST to `/api/bench-push`; Vercel handles persistence

---

## Vercel Environment Variables

Configure these in: https://vercel.com/digitalpros-projects/starlink-performance/settings/environment-variables

### Core variables

| Variable Name | Description |
|--------------|-------------|
| `PROM_URL` | Grafana Cloud Prometheus endpoint (e.g. `https://prometheus-prod-xx.grafana.net/api/v1`) |
| `PROM_BASIC` / `PROM_USER`+`PROM_TOKEN` / `PROM_BEARER` | One of these auth methods is required to reach Prometheus |
| `VERCEL_BYPASS_TOKEN` | Needed only if Vercel deployment protection is enabled (used by benchmark scripts) |
| `VERCEL_ALIAS` | Optional alias applied by `npm run deploy` |

### Optional - For Netdata Integration

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NETDATA_URL` | `https://your-netdata.com` | Full Netdata URL |
| `NETDATA_HOST` | `192.168.1.50` | OR just hostname/IP (uses port 19999) |
| `NETDATA_AUTH_BASIC` | `<base64 string>` | Basic auth: `base64(username:password)` |
| `NETDATA_BEARER` | `<token>` | OR bearer token for Netdata Cloud API |

### Optional - For Prometheus/Grafana Integration

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `PROM_URL` | `https://prometheus-prod-xx.grafana.net/api/v1` | Prometheus API endpoint |
| `PROM_BASIC` | `<base64 string>` | Basic auth: `base64(username:token)` |
| `PROM_USER` | `<username>` | OR username (will combine with PROM_TOKEN) |
| `PROM_TOKEN` | `<token>` | Token for Prometheus |
| `PROM_BEARER` | `<token>` | OR bearer token |

### After Setting Variables

After adding/changing environment variables:
1. Redeploy: `./deploy.sh --prod`
2. Or use Vercel dashboard: **Deployments** → **Redeploy**

---

## Data Collection Options

### Option 1: Netdata (Real-time System Monitoring)

**Best for:** Real-time infrastructure monitoring, system metrics, Starlink connectivity

#### Setup Netdata Cloud

1. Sign up/log in: https://app.netdata.cloud
2. Create a space (or recover your "djc" space)
3. Install Netdata agent on your monitoring server:

```bash
bash <(curl -Ss https://get.netdata.cloud/kickstart.sh)
```

4. Claim your node to Netdata Cloud:
   - Follow prompts during installation
   - Or claim it manually from the Cloud UI

5. Configure Starlink monitoring:
   - Create custom collectors for Starlink metrics
   - Chart names should match:
     - `starlink.ping` (latency)
     - `starlink.packet_loss`
     - `starlink.bandwidth_down`
     - `starlink.bandwidth_up`
     - `anomaly_detection.anomaly_rate`

6. Get API token:
   - In Netdata Cloud: **Space Settings** → **API Tokens**
   - Create new token
   - Add to Vercel as `NETDATA_BEARER`

#### Netdata Account Recovery

If you can't access your "djc" space:
- Try logging in at https://app.netdata.cloud with:
  - Email/password
  - Sign in with Google
  - Sign in with GitHub
- Check email for messages from `@netdata.cloud`
- Search browser history for `app.netdata.cloud/spaces/djc`

### Option 2: Prometheus/Grafana Cloud

**Best for:** Long-term metrics storage, complex queries, PromQL

#### Setup Grafana Cloud

1. Sign up/log in: https://grafana.com/auth/sign-in
2. Navigate to your Prometheus instance
3. Get credentials:
   - **URL:** Find in **Configuration** → **Data Sources** → **Prometheus**
   - Example: `https://prometheus-prod-10-prod-us-central-0.grafana.net/api/v1`
   - **Username/Token:** In **Security** → **API Keys** or **Service Accounts**

4. Configure metrics exporter to push these metrics:
   - `starlink_latency_ms`
   - `starlink_packet_loss_pct`
   - `starlink_bandwidth_down_mbps`
   - `starlink_bandwidth_up_mbps`
   - `starlink_anomaly_rate_pct`

5. Add credentials to Vercel (see above)

### Option 3: Custom Benchmarking Scripts

Recommended path: POST to the `/api/bench-push` endpoint and let Vercel Blob handle storage.

```javascript
// Minimal example
await fetch('https://starlink-performance.vercel.app/api/bench-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    {
      task: 'custom-run',
      start: Date.now() - 5000,
      end: Date.now(),
      metadata: { source: 'custom-script' }
    }
  ])
});
```

Need direct access instead? Use `@vercel/blob` from a Vercel function or background job:

```javascript
import { put } from '@vercel/blob';

const payload = {
  timestamp: new Date().toISOString(),
  runs: [ /* ... */ ]
};

await put(`benchmarks/${Date.now()}.json`, JSON.stringify(payload, null, 2), {
  access: 'private',
  contentType: 'application/json'
});
```

---

## Testing & Deployment

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test with local Netdata
NETDATA_HOST=localhost npm run dev

# Test with remote Netdata
NETDATA_URL=https://your-netdata.com npm run dev
```

### Build & Preview

```bash
# Build for production
npm run build

# Preview locally
npm run preview
```

### Deploy to Vercel

```bash
# Deploy to preview
./deploy.sh

# Deploy to production
./deploy.sh --prod
```

### Verify Deployment

1. Check main URL: https://starlink-performance.vercel.app
2. Test API endpoints:
   - https://starlink-performance.vercel.app/api/netdata?chart=starlink.ping&after=-300&points=10
   - https://starlink-performance.vercel.app/api/promql?query=up

---

## Quick Start Checklist

- [ ] Configure Prometheus environment variables (`PROM_URL` + chosen auth)
- [ ] Optionally configure Netdata variables if using the proxy
- [ ] (If deployment protection is on) set `VERCEL_BYPASS_TOKEN` for benchmark uploads
- [ ] Deploy with `npm run deploy`
- [ ] Verify `/api/promql?query=up` and `/api/bench-runs`
- [ ] Spot-check the dashboard at https://starlink-performance.vercel.app

---

## Troubleshooting

### Benchmark overlays not updating
- Ensure deployment protection is disabled or provide `VERCEL_BYPASS_TOKEN` where benchmarks run
- Confirm `/api/bench-push` responds with `{ ok: true }`
- Inspect Vercel logs for `bench-push` failures

### "N/A" values in dashboard
- Check Vercel environment variables
- Verify Prometheus (and Netdata, if enabled) endpoints respond
- Call the API endpoints directly (see Verify Deployment)
- Inspect Vercel function logs: https://vercel.com/digitalpros-projects/starlink-performance/logs

### Local benchmark script fails to reach dev server
- The script auto-starts the task launcher dev server on port 8080; review console output for startup errors
- Set `SKIP_AUTOSTART_DEV_SERVER=1` to manage the server manually
- Override `CYPRESS_BASE_URL` when targeting a custom host/port

---

## Support & Resources

- **Vercel Dashboard:** https://vercel.com/digitalpros-projects/starlink-performance
- **GCP Console:** https://console.cloud.google.com/storage/browser/starlink-performance-dev
- **Netdata Cloud:** https://app.netdata.cloud
- **Grafana Cloud:** https://grafana.com

For issues, check Vercel function logs and GCP Cloud Logging.

