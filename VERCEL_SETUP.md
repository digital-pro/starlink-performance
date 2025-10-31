# Vercel Environment Variables Setup

## 📋 Quick Setup Instructions

Go to: https://vercel.com/digitalpros-projects/starlink-performance/settings/environment-variables

Add these 3 environment variables:

---

### 1. GCP_PROJECT_ID

**Value:**
```
hs-levante-admin-dev
```

---

### 2. GCP_BUCKET_NAME

**Value:**
```
starlink-performance-dev
```

---

### 3. GCP_SERVICE_ACCOUNT_KEY

**Value:** (Copy the entire contents of `secrets/levante-dashboard-dev-key.json`)

⚠️ **Important:** Copy the ENTIRE JSON file including the braces `{` and `}`.

The service account key is located at:
```
/home/david/levante/starlink-performance/secrets/levante-dashboard-dev-key.json
```

You can view it with:
```bash
cat secrets/levante-dashboard-dev-key.json
```

Then copy the entire output and paste it into Vercel as the value for `GCP_SERVICE_ACCOUNT_KEY`.

---

## ✅ After Adding Variables

1. Click "Save" for each variable
2. Deploy: `./deploy.sh --prod`
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

