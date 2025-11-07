# Anomaly Detection - Why It's Different from Starlink App

## 🤔 The Question

"Why don't we see many anomalies when the Starlink app shows a lot of them?"

## 📊 Two Different Systems

### Your Dashboard's "Anomalies"
Your dashboard uses **two types** of anomaly detection:

#### 1. **Statistical Anomaly Detection** (Z-Score Based)
- **API**: `/api/starlink-anomalies` (Python script)
- **Method**: Calculates z-scores for metrics (latency, throughput, packet loss, obstruction)
- **Threshold**: Default 3.5 standard deviations
- **What it detects**: Statistical outliers - values that deviate significantly from the rolling average
- **Current status**: Working, but with HIGH threshold (3.5σ means only extreme outliers trigger)

#### 2. **Netdata ML Anomaly Detection**
- **Source**: Netdata's built-in machine learning
- **Current rate**: ~4% (very low)
- **What it detects**: System-level anomalies across ALL monitored metrics (CPU, disk, network, etc.)
- **Display**: "netdata anomaly rate" line on the chart

### Starlink App's "Anomalies"
The Starlink mobile app shows different types of events:

1. **Obstructions** - Physical blockage of satellites
2. **Beam switching** - Normal handoffs between satellites  
3. **Network interruptions** - Any connectivity loss
4. **Speed variations** - Normal fluctuations in throughput
5. **Latency spikes** - Even small increases (50ms → 80ms)

**Key difference**: The Starlink app has a MUCH lower threshold and counts many normal operational events as "anomalies."

---

## 🎯 What We DO Detect

Your dashboard already detects and displays most of what the Starlink app shows, but calls them **"Starlink Events"** instead:

### Event Detection (Working Well!)

Look at your **"Anomaly Detection & Starlink Events"** chart - you should see vertical event markers for:

- 🔴 **Obstruction spikes** - When obstruction % increases significantly
- 🟠 **Obstruction increased** - Sustained increases in blockage
- ⚠️ **High packet loss** - When loss exceeds 3%
- 🔍 **Sky Search** - When dish is searching for satellites (throughput near zero)
- ✅ **Recovery** - When returning to normal after degradation

**These ARE the "anomalies" from the Starlink app!** They're just displayed differently.

---

## 🔧 Why You're Not Seeing Many "Anomalies"

### Reason 1: High Z-Score Threshold

The statistical anomaly detection uses **z-score = 3.5**, which is VERY conservative:

```
z-score 1.0 = top 16% of values
z-score 2.0 = top 2.5% of values  
z-score 3.0 = top 0.15% of values
z-score 3.5 = top 0.023% of values ← Your setting
```

This means only the most extreme outliers (1 in 4,300 samples!) trigger an "anomaly."

### Reason 2: Starlink is Stable

If your Starlink connection is actually performing well with:
- ✅ Low obstruction (< 1%)
- ✅ Consistent latency (20-40ms)
- ✅ Good throughput
- ✅ Low packet loss

Then **you SHOULDN'T see many anomalies!** That's good!

### Reason 3: Different Definitions

The Starlink app counts things as "anomalies" that are actually:
- Normal beam switching (happens every 15 seconds)
- Expected speed variations (Wi-Fi fluctuations)
- Minor latency increases (network congestion)

Your dashboard filters these out and only shows **significant events**.

---

## 🎨 How to See More Anomalies (If You Want)

### Option 1: Lower the Z-Score Threshold

The anomaly API uses a threshold of **3.5**. You can lower it to see more events.

**Edit**: `api/starlink-anomalies.py`

Find this line (around line 848 in App.vue):
```javascript
threshold: 3.5,
```

Change to:
```javascript
threshold: 2.0,  // More sensitive - will show more anomalies
```

**Recommended thresholds:**
- `3.5` = Very conservative (current) - Only extreme outliers
- `2.5` = Moderate - Significant deviations  
- `2.0` = Sensitive - Most unusual values
- `1.5` = Very sensitive - Many "normal" variations

### Option 2: Check Starlink Events

You're already detecting most issues! Look at the **vertical event markers** on your charts:
- Green ▶ and Red ◼ = Benchmark runs
- Emoji icons (🔴🟠⚠️🔍✅) = Starlink Events

These show obstructions, packet loss, sky searches, etc.

### Option 3: Compare with Grafana

Your Grafana dashboard (https://levanteperformance.grafana.net) shows the same data with different visualizations. Check if you see more "issues" there.

---

## 🧪 Quick Test

Want to see if anomaly detection is working? Run this test:

### 1. Check current anomaly rate:
```bash
curl -s "http://localhost:9090/api/v1/query?query=netdata_anomaly_detection_anomaly_rate_percentage_average" | python3 -m json.tool
```

You should see a value around 0.04 (4%) if things are normal.

### 2. Create an artificial anomaly:
Block your Starlink dish with a large object for 30 seconds, or disconnect the Ethernet cable.

### 3. Watch the dashboard:
Refresh after 1 minute. You should see:
- Spike in latency
- Packet loss increase  
- Starlink Events appear
- Possibly anomaly score increase

---

## 📈 Summary

| Feature | Your Dashboard | Starlink App |
|---------|---------------|--------------|
| **Obstructions** | ✅ Shows as events | ✅ Shows as anomalies |
| **Packet loss** | ✅ Shows as events | ✅ Shows as anomalies |
| **Latency spikes** | ✅ Statistical detection (3.5σ) | ✅ Any increase |
| **Beam switching** | ❌ Filtered out (normal) | ✅ Shows as anomalies |
| **Speed variations** | ❌ Filtered out (normal) | ✅ Shows as anomalies |
| **Network outages** | ✅ Sky Search detection | ✅ Shows as anomalies |
| **Threshold** | High (significant only) | Low (everything) |

---

## 🎯 Recommendations

### If You Want Dashboard Like Starlink App:

**Lower the threshold** in the dashboard query (change 3.5 to 2.0).

### If You Want Meaningful Alerts Only:

**Keep current settings** - your dashboard is filtering out noise and showing real issues!

### If You're Not Seeing Expected Issues:

Check:
1. Is Netdata running? `systemctl status netdata`
2. Is Prometheus scraping Netdata? Check targets at http://localhost:9090/targets
3. Are Starlink Events showing on the chart? (Look for emoji markers)

---

## 🔍 The Real Answer

**You probably ARE seeing the same things as the Starlink app**, just with different labeling:

- Starlink app's "anomalies" = Your dashboard's "Starlink Events" (🔴🟠⚠️🔍✅)
- Starlink app's "issues" = Your latency/packet loss charts showing spikes
- Starlink app's "interruptions" = Your Sky Search events

The Starlink app is more "alarmist" and flags everything. Your dashboard is more technical and filters to show **actually important events**.

**Both are correct - they just have different philosophies!** ⚖️

---

## 💡 Pro Tip

The **"Starlink Events"** section of your dashboard (with the emoji markers) is essentially your version of the Starlink app's "anomalies" feed. If you're seeing events there, your system is working perfectly!

If your connection is stable and healthy, **not seeing many anomalies is a GOOD thing!** 🎉

