# Task Benchmarks with Dashboard Integration

Run Levante task benchmarks and visualize them on the performance dashboard with vertical line markers.

## 🚀 Quick Start

### Run intro and push to dashboard:

```bash
cd /home/david/levante/starlink-performance/task-benchmarks
./run-intro-and-push.sh
```

This will:
1. Run the intro Cypress test
2. Record timing data to `runs.ndjson`
3. Push results to https://starlink-performance.vercel.app
4. Vertical lines will appear on the dashboard charts marking when the test started/ended

## 📊 View Results

Open https://starlink-performance.vercel.app

You'll see:
- **Green vertical lines** = benchmark task start time
- **Red vertical lines** = benchmark task end time
- **Labels** = task name (e.g., "intro")

The vertical lines appear on both:
- Latency chart
- Bandwidth chart

## 🔧 Commands

### Run specific task and push:

```bash
# Run intro
npm run timings:one intro
npm run push

# Run theory_of_mind
npm run timings:one theory_of_mind
npm run push

# Run all tasks
npm run timings:all
npm run push
```

### Push existing data to dashboard:

```bash
npm run push
```

This reads from `runs.ndjson` and uploads to the dashboard.

## 📝 Benchmark Data

### Files:
- `runs.ndjson` - Line-delimited JSON, append-only (primary source)
- `runs.json` - Pretty JSON array (for human reading)
- `cypress/timing/` - Timing data directory

### Data Format:

```json
{
  "task": "intro",
  "spec": "cypress/e2e/intro.cy.js",
  "timestamp": "2025-10-24T18:28:07.953Z",
  "finishedAt": "2025-10-24T18:28:10.954Z",
  "status": "failed",
  "real": "0m3.001s",
  "realSeconds": 3.001,
  "cypressDurationMs": 2253,
  "totals": {"tests": 1, "passes": 0, "failures": 1},
  "startPT": "11:28 PT",
  "finishPT": "11:28 PT"
}
```

## 🎯 Workflow Example

### Measure Starlink impact on task performance:

1. **Start the dev server:**
   ```bash
   cd /home/david/levante/core-tasks/task-launcher
   npx webpack serve --mode development --port 8080
   ```

2. **In another terminal, run benchmarks:**
   ```bash
   cd /home/david/levante/starlink-performance/task-benchmarks
   
   # Run intro during good conditions
   PROVIDER=Starlink ./run-intro-and-push.sh
   
   # Wait for network conditions to change
   # Run again during poor conditions
   PROVIDER=Starlink ./run-intro-and-push.sh
   ```

3. **View dashboard:**
   - Go to https://starlink-performance.vercel.app
   - See vertical lines showing when each test ran
   - Compare latency/bandwidth during each test period

## 📈 Dashboard Features

The dashboard shows:
- **Real-time metrics** from Prometheus
- **Benchmark markers** as vertical lines
- **Latency spikes** during task execution
- **Bandwidth usage** patterns
- **Packet loss** correlation

This helps you:
- Identify network issues during specific tasks
- Compare task performance under different conditions
- Debug slow task execution
- Validate network improvements

## 🔄 Auto-push Setup (Optional)

To automatically push after every benchmark run, modify `run_all_and_record.js`:

Add at the end of the `main()` function (before the final console.log):

```javascript
// Auto-push to dashboard
try {
  const { execSync } = await import('child_process');
  console.log('\nPushing results to dashboard...');
  execSync('npm run push', { stdio: 'inherit' });
} catch (e) {
  console.warn('Could not auto-push:', e.message);
}
```

## 🐛 Troubleshooting

### "Error pushing to dashboard"
- Ensure deployment protection is disabled or provide `VERCEL_BYPASS_TOKEN`
- Check Vercel function logs for `bench-push` errors

### "No runs found in runs.ndjson"
- Run a benchmark first: `npm run timings:one intro`
- Check file exists: `cat runs.ndjson`

### Vertical lines don't appear
- Refresh the dashboard
- Check browser console for errors
- Verify data was pushed: call `/api/bench-runs` or check Vercel Blob via `vercel blob list benchmarks/`

### Task launcher not reachable
- Ensure dev server is running on port 8080
- Check: `curl http://localhost:8080`

## 📚 More Info

See also:
- `README_BENCHMARKS.md` - Full benchmark documentation
- `README_CONFIG.md` - Dashboard configuration
- `VERCEL_SETUP.md` - Environment variables

## 🎉 Success Criteria

You know it's working when:
1. ✅ Benchmark runs without errors
2. ✅ `npm run push` shows "Success!"
3. ✅ Dashboard shows vertical green/red lines
4. ✅ Lines align with timestamp of your test runs

