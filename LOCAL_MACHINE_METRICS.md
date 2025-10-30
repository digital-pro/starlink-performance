# Local Machine Metrics Reference

This document describes all local machine metrics collected by the dashboard and their diagnostic value for troubleshooting connection issues.

## Network Interface Metrics

### `windows_wifi_link_speed_mbps`
**What it is:** Negotiated link speed (theoretical maximum) between WiFi adapter and router in Mbps.

**Why it's useful:**
- **Baseline:** Establishes maximum possible throughput between computer and router
- **Lower than expected:** May indicate WiFi configuration issues, interference, or distance from router
- **Comparison:** If WiFi link speed is lower than Starlink throughput, WiFi may be bottleneck
- **Changes:** Link speed changes may indicate WiFi adapter issues or signal strength variations
- **Not actual throughput:** This is theoretical max, not actual data transfer rate

### Network Interface Errors (Proposed)
**What it is:** Packet errors, drops, and collisions on network interface.

**Why it would be useful:**
- **Local vs Starlink:** Helps distinguish between local network issues and Starlink issues
- **Hardware problems:** High error rates may indicate failing network adapter or cable
- **Driver issues:** May indicate driver problems or compatibility issues
- **Interference:** WiFi errors may indicate local interference sources

### TCP Retransmissions (Proposed)
**What it is:** Count of TCP segments that had to be retransmitted.

**Why it would be useful:**
- **Packet loss detection:** Retransmissions indicate packet loss somewhere in path
- **Path analysis:** Helps identify if loss is local (high retransmissions) vs Starlink (low retransmissions but high Starlink packet loss)
- **Application impact:** High retransmissions cause application slowdowns
- **Network quality:** Indicator of overall network quality from application perspective

## System Resource Metrics

### CPU Usage (via Netdata)
**What it is:** CPU utilization percentage from Netdata monitoring.

**Why it's useful:**
- **Bottleneck identification:** High CPU usage may limit network performance
- **Correlation:** May correlate with latency spikes (high CPU = processing delays)
- **Background processes:** Helps identify if background processes are affecting network performance
- **System health:** Overall system performance indicator

### Memory Usage (via Netdata)
**What it is:** Memory utilization percentage from Netdata monitoring.

**Why it's useful:**
- **Swapping:** High memory usage may cause swapping, degrading network performance
- **Resource contention:** System low on memory may throttle network operations
- **Application issues:** Memory leaks may degrade overall system performance

### Network Interface Throughput (via Netdata)
**What it is:** Actual bytes per second transmitted/received on network interface.

**Why it's useful:**
- **Actual usage:** Shows real network utilization vs theoretical link speed
- **Comparison:** Compare with Starlink throughput to identify bottlenecks
- **Saturation:** Helps identify when network interface is saturated
- **Application-level:** Shows what applications are actually using

## Anomaly Detection

### `netdata_anomaly_detection_anomaly_rate_percentage_average`
**What it is:** Percentage of time periods flagged as anomalous by Netdata's ML anomaly detection.

**Why it's useful:**
- **Automated detection:** Machine learning identifies unusual patterns automatically
- **Early warning:** May detect issues before they become severe
- **Pattern recognition:** Identifies recurring anomalies that might not be obvious
- **Baseline comparison:** Compares current behavior to historical baseline
- **Multi-metric:** Considers multiple metrics together for comprehensive anomaly detection

## DNS Resolution Metrics (Proposed)

### DNS Query Time
**What it is:** Time taken to resolve DNS queries.

**Why it would be useful:**
- **Slow DNS:** Slow DNS resolution makes all network requests feel slow
- **DNS server issues:** May indicate DNS server problems or misconfiguration
- **Local vs remote:** Helps identify if DNS issues are local or upstream
- **Application impact:** Slow DNS affects all web browsing and API calls

### DNS Failure Rate
**What it is:** Percentage of DNS queries that fail.

**Why it would be useful:**
- **DNS server problems:** High failure rate indicates DNS server issues
- **Configuration issues:** May indicate incorrect DNS server configuration
- **Network issues:** DNS failures may indicate broader network problems

## Diagnostic Workflow

### Identifying Local vs Starlink Issues

1. **Check WiFi Link Speed:**
   - If WiFi link speed is much lower than Starlink throughput → WiFi bottleneck
   - If WiFi link speed is higher than Starlink throughput → Starlink is limiting factor

2. **Check Network Interface Errors:**
   - High errors on local interface → Local network problem
   - Low errors locally but high Starlink packet loss → Starlink problem

3. **Check System Resources:**
   - High CPU/Memory → System resource contention may affect network
   - Normal CPU/Memory → Issue likely network-related, not system-related

4. **Check Anomaly Detection:**
   - High anomaly rate → Something unusual happening (needs investigation)
   - Low anomaly rate → System operating normally

5. **Correlate with Starlink Metrics:**
   - Local metrics normal + Starlink metrics abnormal → Starlink issue
   - Local metrics abnormal + Starlink metrics normal → Local issue
   - Both abnormal → Complex issue affecting entire path

### Common Scenarios

**Scenario 1: Slow Downloads**
- Check: WiFi link speed, actual interface throughput, CPU usage
- If WiFi link speed low → WiFi bottleneck
- If CPU high → System bottleneck
- If both normal → Likely Starlink issue

**Scenario 2: High Latency**
- Check: CPU usage, DNS query time, network errors
- If CPU high → System processing delays
- If DNS slow → DNS server issues
- If both normal → Likely Starlink latency issue

**Scenario 3: Intermittent Connectivity**
- Check: Network interface errors, anomaly detection
- If local errors high → Local network instability
- If anomalies detected → Pattern-based issue
- If both normal → Likely Starlink obstruction or handoff issues

**Scenario 4: Packet Loss**
- Check: Network interface errors, TCP retransmissions
- If local errors high → Local network problem
- If retransmissions high locally → Local packet loss
- If both normal but Starlink packet loss high → Starlink issue

## Integration with Starlink Metrics

Local machine metrics are most useful when combined with Starlink metrics:

- **WiFi Link Speed vs Starlink Throughput:** Identifies where bottleneck is
- **Local Errors vs Starlink Packet Loss:** Distinguishes local vs remote issues
- **CPU Usage vs Latency:** Identifies if latency is system-related
- **Anomaly Detection + Starlink Events:** Correlates local anomalies with Starlink events

## Future Enhancements

Potential metrics to add:
- **Network interface statistics:** Errors, drops, collisions
- **TCP connection metrics:** Retransmissions, connection state
- **DNS performance:** Query times, failure rates
- **Application-level metrics:** Per-application network usage
- **WiFi signal strength:** RSSI (Received Signal Strength Indicator)
- **WiFi channel utilization:** Interference detection

