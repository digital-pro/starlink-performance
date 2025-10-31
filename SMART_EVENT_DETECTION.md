# Smart Starlink Event Detection

## Overview
The dashboard now automatically detects and displays Starlink events by analyzing real-time metrics, providing the same visibility as the Starlink mobile app without requiring access to SpaceX's cloud service.

## How It Works

### The Challenge
- Starlink mobile app shows events like "Sky Search", "Obstruction", etc.
- These events come from SpaceX's cloud service (not accessible to us)
- Local dish API doesn't provide a structured event log

### Our Solution
**Infer events from metric patterns** - just like a doctor diagnoses illness from symptoms!

## Event Detection Logic

### 🔍 Sky Search
**What it means**: Dish is scanning the sky for satellite connectivity

**How we detect it**:
```javascript
downlink_throughput < 1000 bytes/sec AND uplink_throughput < 1000 bytes/sec
```

**Why this works**: When the dish loses satellite lock, both upload and download drop to near-zero while it searches.

---

### 🚫 Obstruction
**What it means**: Trees, buildings, or objects blocking the dish's view

**How we detect it**:
```javascript
fraction_obstruction_ratio > 0.02 (2%)
```

**Why this works**: The dish continuously monitors its field of view. When obstructions are detected, this metric spikes.

---

### ⚠️ Network Degradation
**What it means**: Poor connection quality (not a complete outage)

**How we detect it**:
```javascript
(packet_loss > 5% OR latency > 100ms) AND throughput > 10KB/sec
```

**Why this works**: High loss/latency with some throughput indicates network congestion, interference, or satellite handoff issues.

---

### ✅ Recovery
**What it means**: Return to normal operation

**How we detect it**:
```javascript
Metrics return to healthy ranges after an event
```

**Why this works**: When conditions improve, we close the event and report the duration.

## Example Output

```
📡 Detected 8 Starlink events in last 60min

Recent Events:
🔍 Sky search started                    Oct 25, 14:23
✅ Connected (searched 8s)                Oct 25, 14:23
🚫 Obstruction detected (3.2%)            Oct 25, 14:45
✓  Obstruction cleared (12s)              Oct 25, 14:45
⚠️ Network degradation (8.3% loss)        Oct 25, 15:12
✓  Network recovered (45s)                Oct 25, 15:13
```

## Visual Display

Events appear on the **Anomaly Detection chart** as:
- **Vertical mark lines** at event start times
- **Color-coded** by event type (orange for search, red for obstruction, yellow for degradation, green for recovery)
- **Labeled** with event description and duration
- **Clickable** for detailed information

## Metrics Used

1. `starlink_dish_uplink_throughput_bytes` - Data from dish to satellite (user download)
2. `starlink_dish_downlink_throughput_bytes` - Data from satellite to dish (user upload)
3. `starlink_dish_fraction_obstruction_ratio` - Percentage of sky view obstructed
4. `starlink_dish_pop_ping_drop_ratio` - Packet loss percentage
5. `starlink_dish_pop_ping_latency_seconds` - Round-trip latency

## Advantages

✅ **No cloud dependency** - Works entirely with local dish data  
✅ **Real-time** - Events detected as they happen (30s scrape interval)  
✅ **Accurate** - Based on the same metrics SpaceX uses internally  
✅ **Historical** - View events over any time range (10min to 12 hours)  
✅ **Detailed** - Shows event durations and severity  

## Tuning

Current thresholds are conservative to avoid false positives:
- Sky search: < 1000 bytes/sec (~8 Kbps)
- Obstruction: > 2% obstruction fraction
- Network issue: > 5% packet loss OR > 100ms latency

These can be adjusted in `App.vue` if needed for your environment.

## Comparison to Mobile App

| Feature | Mobile App | Our Dashboard |
|---------|-----------|---------------|
| Data Source | SpaceX Cloud | Local Dish |
| Event Types | Sky Search, Obstruction, etc. | Same (inferred) |
| Real-time | ✅ | ✅ |
| Historical | Limited | Full (any range) |
| Requires Internet | ✅ | ❌ (local only) |
| Shows Durations | ❌ | ✅ |
| Overlay on Charts | ❌ | ✅ |

## Technical Implementation

See `STARLINK_HISTORY_ENHANCEMENT.md` for full technical details.

Key function: `loadStarlinkEvents()` in `/apps/vue-dashboard/src/App.vue`
- Fetches 5 metrics over selected time range
- Analyzes each data point for state transitions
- Generates event log with timestamps and descriptions
- Overlays events on Anomaly Detection chart

## Deployed

✅ Live at: https://starlink-performance-digitalpros-projects.vercel.app

Check the browser console for: `📡 Detected X Starlink events in last Ymin`
