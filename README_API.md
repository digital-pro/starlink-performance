# Local API Development Setup

This project uses Vercel serverless functions for API endpoints (`/api/*`). To run the API locally:

## Setup

1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. Create `.env.local` file (already created):
   ```bash
   PROM_URL=http://localhost:9090/api/v1
   ```

3. Start Vercel dev server:
   ```bash
   vercel dev
   ```

This will:
- Start a local dev server (usually on port 3000)
- Proxy API routes (`/api/ai-correlate`, `/api/promql`, etc.)
- Use environment variables from `.env.local`

## API Endpoints

- `/api/ai-correlate` - Latency correlation analysis (requires PROM_URL)
- `/api/promql` - Prometheus query proxy
- `/api/bench-runs` - Benchmark run data
- `/api/netdata-proxy` - Netdata proxy (legacy)

## Troubleshooting

If the dashboard can't reach `/api/ai-correlate`:
1. Ensure `vercel dev` is running
2. Check that `PROM_URL` in `.env.local` points to your Prometheus instance
3. Verify Prometheus is accessible at the URL specified
