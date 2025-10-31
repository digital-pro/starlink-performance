# Starlink Performance - Configuration Guide

This guide walks you through setting up the complete monitoring and benchmarking system for Starlink Performance.

## Table of Contents
1. [Google Cloud Storage Setup](#google-cloud-storage-setup)
2. [Service Account Permissions](#service-account-permissions)
3. [Vercel Environment Variables](#vercel-environment-variables)
4. [Data Collection Options](#data-collection-options)
5. [Testing & Deployment](#testing--deployment)

---

## Google Cloud Storage Setup

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

## Service Account Permissions

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

## Vercel Environment Variables

Configure these in: https://vercel.com/digitalpros-projects/starlink-performance/settings/environment-variables

### Required for GCS Access

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `GCP_PROJECT_ID` | `hs-levante-admin-dev` | Google Cloud project ID |
| `GCP_BUCKET_NAME` | `starlink-performance-dev` | Storage bucket name |
| `GCP_SERVICE_ACCOUNT_KEY` | `<paste entire JSON>` | Service account credentials (paste entire content of `levante-dashboard-dev-key.json`) |

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

Write benchmark data directly to GCS:

```javascript
// Example: Write benchmark results
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('starlink-performance-dev');

const data = {
  timestamp: new Date().toISOString(),
  latency: 45.3,
  bandwidth_down: 150.2,
  bandwidth_up: 20.5
};

await bucket.file(`benchmarks/${Date.now()}.json`).save(JSON.stringify(data));
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

- [ ] Grant service account "Storage Admin" role on `starlink-performance-dev`
- [ ] Set CORS on bucket: `gsutil cors set cors.json gs://starlink-performance-dev`
- [ ] Add `GCP_SERVICE_ACCOUNT_KEY` to Vercel environment variables
- [ ] Add `GCP_PROJECT_ID` and `GCP_BUCKET_NAME` to Vercel
- [ ] Choose monitoring: Set up Netdata OR Prometheus
- [ ] Add monitoring credentials to Vercel environment variables
- [ ] Redeploy: `./deploy.sh --prod`
- [ ] Test dashboard at https://starlink-performance.vercel.app

---

## Troubleshooting

### "AccessDeniedException" when accessing bucket
- Grant service account proper roles (see Step 1)
- Wait 1-2 minutes for permissions to propagate

### "CORS error" in browser console
- Run `gsutil cors set cors.json gs://starlink-performance-dev`
- Verify domain matches in `cors.json`

### "N/A" values in dashboard
- Check Vercel environment variables are set
- Check Netdata/Prometheus is running and accessible
- Check API endpoints directly (see Verify Deployment)
- Check Vercel function logs: https://vercel.com/digitalpros-projects/starlink-performance/logs

### Service account key not found in Vercel
- Copy entire JSON content (including `{` and `}`)
- Paste as single-line or multi-line in Vercel env vars
- Redeploy after adding

---

## Support & Resources

- **Vercel Dashboard:** https://vercel.com/digitalpros-projects/starlink-performance
- **GCP Console:** https://console.cloud.google.com/storage/browser/starlink-performance-dev
- **Netdata Cloud:** https://app.netdata.cloud
- **Grafana Cloud:** https://grafana.com

For issues, check Vercel function logs and GCP Cloud Logging.

