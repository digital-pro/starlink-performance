# Prometheus → Grafana Cloud (remote_write)

Use this to push your existing Prometheus metrics (local + starlink nodes) to Grafana Cloud so the web dashboard has cloud-visible data.

## What you need
- Grafana Cloud stack instance ID (e.g., `2743807`).
- A Grafana Cloud Access Policy token with `metrics:write` (starts with `glc_...`).
  - Create it in your stack: Access → Access Policies → Create token → Product: Prometheus/Metrics → Scope: metrics:write.

## Files here
- `prometheus-remote-write.yml`: snippet you add to each node's `prometheus.yml`.
- `generate-remote-write.sh`: helper to fill in instance ID and token.

## Quick start (each node)
1) Save your write token in `secrets/grafana_write_token.txt` (do not commit).
2) Generate a snippet for this node:
```bash
cd /home/djc/levante/levante-performance/deployment
INSTANCE_ID=2743807 SITE=local ./generate-remote-write.sh > remote-write.local.yml
# on the starlink node: SITE=starlink ./generate-remote-write.sh > remote-write.starlink.yml
```
3) Merge the generated YAML into your Prometheus config (`/etc/prometheus/prometheus.yml` or your Docker-mounted file):
- Add/merge the `external_labels` block (adjust `site:` for each node)
- Add/merge the `remote_write:` block (do not duplicate, keep one entry pointing to Grafana Cloud)
4) Restart Prometheus:
```bash
# systemd
sudo systemctl restart prometheus
# or Docker
docker restart prometheus
```
5) Verify in Grafana Cloud (Explore → Prometheus): run `up`.
- You should see series; labels will include `site="local"` or `site="starlink"`.

## Notes
- Write URL for your stack/region: `https://prometheus-prod-36-prod-us-west-0.grafana.net/api/prom/api/v1/write`
- Username is your instance ID. Password is the `glc_...` write token.
- Keep your scrape jobs (Starlink exporter, Netdata) as-is; only add the `remote_write` stanza.
