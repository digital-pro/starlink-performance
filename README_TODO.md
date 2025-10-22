# Monitoring & Correlation Plan – Status and Next Steps

This file tracks what’s implemented, what’s partial, and what’s planned for the Starlink/app/system monitoring and correlation work.

## Implemented now

- Starlink metrics and diagnostics in Grafana
  - Recording rules: `starlink_latency_ms`, `starlink_packet_loss_pct`, `starlink_down_mbps`, `starlink_up_mbps`
  - Diagnostic flags: `starlink_latency_spike`, `starlink_micro_loss`, `starlink_outage_active`, `starlink_obstruction_present`
  - Overlays and synchronized time-series added in the advanced dashboard
- System metrics (local machine)
  - `node_exporter` running and scraped (CPU%, memory% used, disk IO time, NIC drops)
  - Overlay panels: Latency vs CPU util, Latency vs Network drops
- Correlation/AI endpoint (serverless)
  - `GET /api/ai-correlate?seconds=900&step=10`
  - Returns windowed correlations (latency vs CPU, latency vs drops) and 15s periodicity detection
- Reliability tooling
  - Watchdog: auto-restarts `starlink_exporter` and Prometheus if down
  - Manual scripts: restart exporter/stack; ops scripts for verify/diagnose
- Dashboard (signed-in)
  - Advanced UID (signed-in): `/d/2cce082a-6360-4f2c-b687-9d3f937e8270/starlink-performance-advanced`

## Partially implemented

- Composite dashboards
  - Synchronized time-series: present (Starlink + overlays)
  - Heatmaps: not added yet
  - Outage cause breakdown: not added yet (from `starlink_dish_outage_duration` by cause)
- Smart alerts
  - Not configured yet in Grafana Cloud (correlated, multi-condition)
- Fine granularity
  - Current range steps at ~10s; true sub-second requires higher scrape cost (to be evaluated)
- Application metrics
  - Not yet wired (p95/p99 latency, timeouts/errors, throughput)

## Next steps (model/AI + gaps)

- Add heatmap panels for latency distribution (to expose 15s “heartbeat” spikes)
- Add outage cause breakdown panel (cause labels)
- Configure Grafana Cloud alert rules (multi-condition)
  - Example: Starlink latency spike AND app p99 degraded
  - Example: Micro-loss correlated with app error rate
  - Host resource saturation (CPU/mem/disk) to exclude local bottlenecks
- Active probing
  - Add `blackbox_exporter` job (ping/HTTP), plus panels for external latency/loss
  - Optional scheduled bandwidth tests off-peak for baselines
- Application metrics
  - Scrape app `/metrics` (if available) and add panels for p95/p99, errors/timeouts, throughput
  - Include in correlation and alerts
- UI correlation badges
  - Wire the Vue app to call `/api/ai-correlate` and display correlation/periodicity badges with the chosen window

## Current links (for reference)

- Signed-in advanced dashboard (latest):
  - `https://levanteperformance.grafana.net/d/2cce082a-6360-4f2c-b687-9d3f937e8270/starlink-performance-advanced?from=now-6h&to=now&timezone=browser&refresh=30s`
- Public dashboards
  - Previous public links returned “failed to load application files”; re-issue public dashboards once the stack has public rendering enabled and panels are bound to Cloud Prometheus explicitly.

## Operational notes

- Restart stack: `npm run restart:stack`
- Start watchdog: `npm run watchdog:start`
- Diagnose (local): `npm run diagnose:starlink`
- Import latest Grafana JSON: `STACK_HOST=<stack>.grafana.net npm run grafana:import`


