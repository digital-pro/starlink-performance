# Starlink Metrics Reference

This document describes all Starlink metrics collected by the dashboard and their diagnostic value for troubleshooting connection issues.

## Core Performance Metrics

### `starlink_dish_pop_ping_latency_seconds`
**What it is:** Round-trip latency (ping time) from dish to PoP (Point of Presence) in seconds.

**Why it's useful:** 
- **Low latency (< 20ms):** Normal operation
- **High latency (> 60ms):** May indicate network congestion, beam switching, or obstruction
- **Spikes:** Often correlate with satellite handoffs or temporary signal degradation
- Essential for real-time applications (gaming, video calls)

### `starlink_dish_pop_ping_drop_ratio`
**What it is:** Percentage of pings that fail or timeout (0.0 = 0%, 1.0 = 100%).

**Why it's useful:**
- **0%:** Perfect connection
- **> 1%:** Indicates packet loss - major issue for all applications
- **Persistent drops:** May indicate obstruction, hardware issues, or severe interference
- Combined with latency, helps identify network quality issues

### `starlink_dish_downlink_throughput_bytes` / `starlink_dish_uplink_throughput_bytes`
**What it is:** Current bandwidth in bytes per second (downlink = download, uplink = upload).

**Why it's useful:**
- **Throughput drops:** May indicate congestion, beam switching, or signal issues
- **Intermittent drops:** Often correlates with satellite handoffs
- **Sustained low throughput:** May indicate obstruction or hardware problems
- Combined with latency/packet loss, helps identify root cause

### `starlink_micro_loss`
**What it is:** Microsecond-level packet loss detection (0.0 = no loss, 1.0 = complete loss).

**Why it's useful:**
- More sensitive than ping drop ratio
- Detects very brief signal interruptions
- Useful for identifying intermittent issues that might not show up in regular packet loss metrics

## Signal Quality Metrics

### `starlink_dish_snr`
**What it is:** Signal-to-Noise Ratio in decibels (dB). Higher is better.

**Why it's useful:**
- **> 10 dB:** Excellent signal quality
- **5-10 dB:** Good signal quality
- **< 5 dB:** Poor signal - likely experiencing issues
- **Dropping SNR:** May indicate obstruction, interference, or dish misalignment
- Critical for understanding signal quality before throughput/latency issues manifest

### `starlink_dish_bore_sight_azimuth_deg` / `starlink_dish_bore_sight_elevation_deg`
**What it is:** Dish pointing direction - azimuth (compass direction) and elevation (angle above horizon) in degrees.

**Why it's useful:**
- **Tracking changes:** Dish may reorient during satellite handoffs or sky search
- **Unusual angles:** May indicate installation issues or obstruction forcing dish to unusual position
- **Stability:** Constant small adjustments normal, large jumps may indicate issues
- Helps verify dish is properly aligned and tracking satellites

## Connection State Metrics

### `starlink_dish_state`
**What it is:** Current operational state (0 = Unknown, 1 = Booting, 2 = Searching, 3 = Connected).

**Why it's useful:**
- **State = 2 (Searching):** Normal during startup or after obstruction - no connectivity expected
- **State = 3 (Connected):** Normal operation - should see throughput
- **State = 2 while state = 3 expected:** Indicates connection loss or severe obstruction
- Essential for understanding whether issues are expected (during search) or abnormal

### `starlink_dish_backup_beam`
**What it is:** Whether dish is using backup beam (0 = primary, 1 = backup).

**Why it's useful:**
- **Backup beam active:** May indicate primary beam unavailable or degraded
- **Frequent switching:** May indicate unstable connection or interference
- **Backup beam performance:** Typically lower throughput/latency than primary
- Helps explain performance degradation when primary beam has issues

### `starlink_dish_time_to_slot_end_seconds`
**What it is:** Seconds until current time slot ends (beam scheduling).

**Why it's useful:**
- **Regular patterns:** Normal - shows beam scheduling cycles
- **Irregular patterns:** May indicate scheduling issues or connection instability
- **Near-zero values:** May indicate upcoming beam switch or handoff
- Helps predict when throughput might change due to scheduling

### `starlink_dish_first_nonempty_slot_seconds`
**What it is:** Seconds until next available time slot.

**Why it's useful:**
- **High values:** May indicate congestion or scheduling issues
- **Zero values:** Normal - immediate slot availability
- **Fluctuating values:** May indicate unstable connection or interference
- Helps understand scheduling delays that might affect throughput

## Obstruction Metrics

### `starlink_dish_fraction_obstruction_ratio`
**What it is:** Percentage of sky view obstructed (0.0 = 0%, 1.0 = 100%).

**Why it's useful:**
- **0%:** Ideal - no obstruction
- **< 5%:** Usually acceptable
- **> 5%:** Likely causing periodic outages or degraded performance
- **100%:** Complete obstruction - no connectivity expected
- Primary metric for identifying physical obstruction issues

### `starlink_dish_currently_obstructed`
**What it is:** Boolean flag (0 = not obstructed, 1 = currently obstructed).

**Why it's useful:**
- **Currently obstructed:** Explains immediate connectivity loss
- **Intermittent obstruction:** Causes periodic outages
- **Persistent obstruction:** Requires physical fix (move dish, trim trees)
- Quick indicator of current obstruction status

### `starlink_dish_last_24h_obstructed_seconds`
**What it is:** Total seconds obstructed in last 24 hours.

**Why it's useful:**
- **High values:** Indicates frequent or persistent obstruction
- **Trend analysis:** Track improvement/degradation over time
- **Context:** Helps understand impact of obstructions on daily usage
- Useful for long-term obstruction assessment

### `starlink_dish_prolonged_obstruction_duration_seconds`
**What it is:** Duration of current prolonged obstruction.

**Why it's useful:**
- **Prolonged obstructions:** More serious than brief obstructions
- **Long durations:** May indicate permanent obstruction requiring physical fix
- **Patterns:** Helps identify time-of-day or weather-related obstruction patterns

### `starlink_dish_wedge_fraction_obstruction_ratio`
**What it is:** Directional obstruction in specific wedge/sector of sky view.

**Why it's useful:**
- **Directional data:** Helps identify which direction obstruction is coming from
- **Targeted fixes:** Can help optimize dish placement or identify specific obstacles
- **More granular:** More specific than overall obstruction ratio

## Hardware & System Metrics

### `starlink_dish_alert_motors_stuck`
**What it is:** Alert flag indicating dish motors are stuck.

**Why it's useful:**
- **Motors stuck:** Dish cannot track satellites - will cause connection issues
- **Requires physical inspection:** May need to reset or repair dish
- **Critical alert:** Immediate attention required

### `starlink_dish_alert_thermal_throttle`
**What it is:** Alert flag indicating dish is throttling due to overheating.

**Why it's useful:**
- **Thermal throttling:** Performance degradation due to heat
- **May indicate:** Poor ventilation, direct sunlight, or hardware issue
- **Temporary:** Usually resolves when temperature drops
- **Performance impact:** Throttling reduces throughput

### `starlink_dish_alert_thermal_shutdown`
**What it is:** Alert flag indicating dish shut down due to overheating.

**Why it's useful:**
- **Complete shutdown:** No connectivity - more serious than throttling
- **Requires cooling:** Dish must cool before restarting
- **Hardware issue:** May indicate defective unit or extreme conditions

### `starlink_dish_alert_mast_not_near_vertical`
**What it is:** Alert flag indicating dish mast is not properly vertical.

**Why it's useful:**
- **Installation issue:** Dish may not be properly installed
- **Tracking problems:** May cause poor satellite tracking
- **Requires physical fix:** Dish needs to be re-leveled

### `starlink_dish_uptime_seconds`
**What it is:** How long dish has been powered on and operational.

**Why it's useful:**
- **Recent restarts:** May indicate issues causing reboots
- **Long uptime:** Indicates stable operation
- **Correlation:** Helps correlate issues with recent reboots or updates

### `starlink_dish_valid_seconds`
**What it is:** Seconds of valid data collection (vs total uptime).

**Why it's useful:**
- **Low valid time:** May indicate frequent outages or data collection issues
- **Ratio with uptime:** Helps understand connection stability
- **Data quality:** Indicates reliability of other metrics

## Location & Identification Metrics

### `starlink_dish_gps_latitude` / `starlink_dish_gps_longitude`
**What it is:** GPS coordinates of dish location.

**Why it's useful:**
- **Verification:** Confirms dish location matches expected installation site
- **Context:** Helps understand local conditions (terrain, weather patterns)
- **Support:** Useful for support tickets or troubleshooting

### `starlink_dish_cell_id`
**What it is:** Network cell identifier where dish is located.

**Why it's useful:**
- **Cell-level issues:** May indicate cell-wide problems vs individual dish issues
- **Support:** Helps support identify which cell might be experiencing issues
- **Comparison:** Can compare with other dishes in same cell

### `starlink_dish_initial_satellite_id` / `starlink_dish_initial_gateway_id`
**What it is:** IDs of satellite and gateway initially connected to.

**Why it's useful:**
- **Connection tracking:** Helps understand which satellites/gateways dish prefers
- **Patterns:** May reveal patterns in connection quality
- **Support:** Useful for support to identify specific satellite/gateway issues

## Derived Metrics (Recording Rules)

### `starlink_packet_loss_pct`
**What it is:** Percentage of packets lost (derived from ping drop ratio).

**Why it's useful:**
- **Easy to read:** Percentage format easier to understand than ratio
- **Thresholds:** > 1% is problematic, > 5% is severe
- **Trend analysis:** Track packet loss over time windows

### `starlink_latency_spike`
**What it is:** Boolean flag indicating latency spike detected (derived from latency).

**Why it's useful:**
- **Quick alert:** Easy way to identify when latency issues occur
- **Threshold detection:** Automatically flags problematic latency
- **Event correlation:** Helps correlate with other events

### `starlink_outage_active`
**What it is:** Boolean flag indicating active outage (derived from multiple metrics).

**Why it's useful:**
- **Quick status:** Single metric to check if connection is down
- **Alerting:** Can trigger alerts when outage detected
- **Dashboard display:** Easy to show current status

## Diagnostic Tips

1. **Start with State:** Check `dish_state` first - if Searching, issues are expected
2. **Check Obstruction:** High obstruction ratio explains most connectivity problems
3. **SNR Before Throughput:** Low SNR often precedes throughput/latency issues
4. **Correlate Metrics:** Combine latency, packet loss, and throughput for full picture
5. **Watch for Patterns:** Recurring patterns may indicate satellite handoffs or scheduled events
6. **Hardware Alerts:** Check alert flags first - they indicate hardware issues requiring physical fixes

