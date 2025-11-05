package exporter

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/danopstech/starlink_exporter/pkg/spacex.com/api/device"
	"github.com/prometheus/client_golang/prometheus"
	log "github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

const (
	// DishAddress to reach Starlink dish ip:port
	DishAddress = "192.168.100.1:9200"
	namespace   = "starlink"
)

var (
	dishUp = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "up"),
		"Was the last query of Starlink dish successful.",
		nil, nil,
	)
	dishScrapeDurationSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "scrape_duration_seconds"),
		"Time to scrape metrics from starlink dish",
		nil, nil,
	)

	// collectDishContext
	dishInfo = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "info"),
		"Running software versions and IDs of hardware",
		[]string{"device_id", "hardware_version", "software_version", "country_code", "utc_offset"}, nil,
	)
	dishUptimeSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "uptime_seconds"),
		"Dish running time",
		nil, nil,
	)
	dishCellId = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "cell_id"),
		"Cell ID dish is located in",
		nil, nil,
	)
	dishPopRackId = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "pop_rack_id"),
		"pop rack id",
		nil, nil,
	)
	dishInitialSatelliteId = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "initial_satellite_id"),
		"initial satellite id",
		nil, nil,
	)
	dishInitialGatewayId = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "initial_gateway_id"),
		"initial gateway id",
		nil, nil,
	)

	// collectDishStatus
	dishSecondsToFirstNonemptySlot = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "first_nonempty_slot_seconds"),
		"Seconds to next non empty slot",
		nil, nil,
	)
	dishPopPingDropRatio = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "pop_ping_drop_ratio"),
		"Percent of pings dropped",
		nil, nil,
	)
	dishPopPingLatencySeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "pop_ping_latency_seconds"),
		"Latency of connection in seconds",
		nil, nil,
	)
	dishUplinkThroughputBytes = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "uplink_throughput_bytes"),
		"Amount of bandwidth in bytes per second upload",
		nil, nil,
	)
	dishDownlinkThroughputBytes = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "downlink_throughput_bytes"),
		"Amount of bandwidth in bytes per second download",
		nil, nil,
	)

	dishDownThroughputAvg5s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "downlink_throughput_bps_avg_5s"),
		"Average downlink throughput (bits/sec) over last 5 seconds sampled locally",
		nil, nil,
	)
	dishDownThroughputAvg10s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "downlink_throughput_bps_avg_10s"),
		"Average downlink throughput (bits/sec) over last 10 seconds sampled locally",
		nil, nil,
	)
	dishDownThroughputAvg15s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "downlink_throughput_bps_avg_15s"),
		"Average downlink throughput (bits/sec) over last 15 seconds sampled locally",
		nil, nil,
	)
	dishUpThroughputAvg5s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "uplink_throughput_bps_avg_5s"),
		"Average uplink throughput (bits/sec) over last 5 seconds sampled locally",
		nil, nil,
	)
	dishUpThroughputAvg10s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "uplink_throughput_bps_avg_10s"),
		"Average uplink throughput (bits/sec) over last 10 seconds sampled locally",
		nil, nil,
	)
	dishUpThroughputAvg15s = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "uplink_throughput_bps_avg_15s"),
		"Average uplink throughput (bits/sec) over last 15 seconds sampled locally",
		nil, nil,
	)

	dishBoreSightAzimuthDeg = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "bore_sight_azimuth_deg"),
		"azimuth in degrees",
		nil, nil,
	)

	dishBoreSightElevationDeg = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "bore_sight_elevation_deg"),
		"elevation in degrees",
		nil, nil,
	)

	// collectDishObstructions
	dishCurrentlyObstructed = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "currently_obstructed"),
		"Status of view of the sky",
		nil, nil,
	)
	dishFractionObstructionRatio = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "fraction_obstruction_ratio"),
		"Percentage of obstruction",
		nil, nil,
	)
	dishLast24hObstructedSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "last_24h_obstructed_seconds"),
		"Number of seconds view of sky has been obstructed in the last 24hours",
		nil, nil,
	)
	dishValidSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "valid_seconds"),
		"Unknown",
		nil, nil,
	)
	dishProlongedObstructionDurationSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "prolonged_obstruction_duration_seconds"),
		"Average in seconds of prolonged obstructions",
		nil, nil,
	)
	dishProlongedObstructionIntervalSeconds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "prolonged_obstruction_interval_seconds"),
		"Average prolonged obstruction interval in seconds",
		nil, nil,
	)
	dishWedgeFractionObstructionRatio = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "wedge_fraction_obstruction_ratio"),
		"Percentage of obstruction per wedge section",
		[]string{"wedge", "wedge_name"}, nil,
	)
	dishWedgeAbsFractionObstructionRatio = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "wedge_abs_fraction_obstruction_ratio"),
		"Percentage of Absolute fraction per wedge section",
		[]string{"wedge", "wedge_name"}, nil,
	)

	// collectDishAlerts
	dishAlertMotorsStuck = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_motors_stuck"),
		"Status of motor stuck",
		nil, nil,
	)
	dishAlertThermalThrottle = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_thermal_throttle"),
		"Status of thermal throttling",
		nil, nil,
	)
	dishAlertThermalShutdown = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_thermal_shutdown"),
		"Status of thermal shutdown",
		nil, nil,
	)
	dishAlertMastNotNearVertical = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_mast_not_near_vertical"),
		"Status of mast position",
		nil, nil,
	)
	dishUnexpectedLocation = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_unexpected_location"),
		"Status of location",
		nil, nil,
	)
	dishSlowEthernetSpeeds = prometheus.NewDesc(
		prometheus.BuildFQName(namespace, "dish", "alert_slow_eth_speeds"),
		"Status of ethernet",
		nil, nil,
	)
)

// Exporter collects Starlink stats from the Dish and exports them using
// the prometheus metrics package.
type Exporter struct {
	Conn        *grpc.ClientConn
	Client      device.DeviceClient
	DishID      string
	CountryCode string
	history     *historySampler
}

// New returns an initialized Exporter.
func New(address string) (*Exporter, error) {
	ctx, connCancel := context.WithTimeout(context.Background(), time.Second*3)
	defer connCancel()
	conn, err := grpc.DialContext(ctx, address, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		return nil, fmt.Errorf("error creating underlying gRPC connection to starlink dish: %s", err.Error())
	}

	ctx, HandleCancel := context.WithTimeout(context.Background(), time.Second*1)
	defer HandleCancel()
	client := device.NewDeviceClient(conn)
	resp, err := client.Handle(ctx, &device.Request{
		Request: &device.Request_GetDeviceInfo{},
	})
	if err != nil {
		return nil, fmt.Errorf("could not collect inital information from dish: %s", err.Error())
	}

	exporter := &Exporter{
		Conn:        conn,
		Client:      client,
		DishID:      resp.GetGetDeviceInfo().GetDeviceInfo().GetId(),
		CountryCode: resp.GetGetDeviceInfo().GetDeviceInfo().GetCountryCode(),
	}
	exporter.history = newHistorySampler(client)

	return exporter, nil
}

// Describe describes all the metrics ever exported by the Starlink exporter. It
// implements prometheus.Collector.
func (e *Exporter) Describe(ch chan<- *prometheus.Desc) {
	ch <- dishUp
	ch <- dishScrapeDurationSeconds

	// collectDishContext
	ch <- dishInfo
	ch <- dishUptimeSeconds
	ch <- dishCellId
	ch <- dishPopRackId
	ch <- dishInitialSatelliteId
	ch <- dishInitialGatewayId

	// collectDishStatus
	ch <- dishSecondsToFirstNonemptySlot
	ch <- dishPopPingDropRatio
	ch <- dishPopPingLatencySeconds
	ch <- dishUplinkThroughputBytes
	ch <- dishDownlinkThroughputBytes
	ch <- dishDownThroughputAvg5s
	ch <- dishDownThroughputAvg10s
	ch <- dishDownThroughputAvg15s
	ch <- dishUpThroughputAvg5s
	ch <- dishUpThroughputAvg10s
	ch <- dishUpThroughputAvg15s
	ch <- dishBoreSightAzimuthDeg
	ch <- dishBoreSightElevationDeg

	// collectDishObstructions
	ch <- dishCurrentlyObstructed
	ch <- dishFractionObstructionRatio
	ch <- dishLast24hObstructedSeconds
	ch <- dishValidSeconds
	ch <- dishProlongedObstructionDurationSeconds
	ch <- dishProlongedObstructionIntervalSeconds
	ch <- dishWedgeFractionObstructionRatio
	ch <- dishWedgeAbsFractionObstructionRatio

	// collectDishAlerts
	ch <- dishAlertMotorsStuck
	ch <- dishAlertThermalThrottle
	ch <- dishAlertThermalShutdown
	ch <- dishAlertMastNotNearVertical
	ch <- dishUnexpectedLocation
	ch <- dishSlowEthernetSpeeds
}

// Collect fetches the stats from Starlink dish and delivers them
// as Prometheus metrics. It implements prometheus.Collector.
func (e *Exporter) Collect(ch chan<- prometheus.Metric) {
	start := time.Now()

	ok := e.collectDishContext(ch)
	ok = ok && e.collectDishStatus(ch)
	ok = ok && e.collectDishObstructions(ch)
	ok = ok && e.collectDishAlerts(ch)

	if ok {
		ch <- prometheus.MustNewConstMetric(
			dishUp, prometheus.GaugeValue, 1.0,
		)
		ch <- prometheus.MustNewConstMetric(
			dishScrapeDurationSeconds, prometheus.GaugeValue, time.Since(start).Seconds(),
		)
	} else {
		ch <- prometheus.MustNewConstMetric(
			dishUp, prometheus.GaugeValue, 0.0,
		)
	}

	if e.history != nil {
		if snap, ok := e.history.snapshot(); ok {
			if snap.DownSupported {
				publishIfFinite(ch, dishDownThroughputAvg5s, snap.DownAvg5s)
				publishIfFinite(ch, dishDownThroughputAvg10s, snap.DownAvg10s)
				publishIfFinite(ch, dishDownThroughputAvg15s, snap.DownAvg15s)
			}
			if snap.UpSupported {
				publishIfFinite(ch, dishUpThroughputAvg5s, snap.UpAvg5s)
				publishIfFinite(ch, dishUpThroughputAvg10s, snap.UpAvg10s)
				publishIfFinite(ch, dishUpThroughputAvg15s, snap.UpAvg15s)
			}
		}
	}
}

func publishIfFinite(ch chan<- prometheus.Metric, desc *prometheus.Desc, value float64) {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return
	}
	ch <- prometheus.MustNewConstMetric(desc, prometheus.GaugeValue, value)
}

func (e *Exporter) collectDishContext(ch chan<- prometheus.Metric) bool {
	req := &device.Request{
		Request: &device.Request_DishGetContext{},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*1)
	defer cancel()
	resp, err := e.Client.Handle(ctx, req)
	if err != nil {
		st, ok := status.FromError(err)
		if ok && st.Code() != 7 {
			log.Errorf("failed to collect dish context: %s", err.Error())
			return false
		}
	}

	dishC := resp.GetDishGetContext()
	dishI := dishC.GetDeviceInfo()
	dishS := dishC.GetDeviceState()

	ch <- prometheus.MustNewConstMetric(
		dishInfo, prometheus.GaugeValue, 1.00,
		dishI.GetId(),
		dishI.GetHardwareVersion(),
		dishI.GetSoftwareVersion(),
		dishI.GetCountryCode(),
		fmt.Sprint(dishI.GetUtcOffsetS()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishUptimeSeconds, prometheus.GaugeValue, float64(dishS.GetUptimeS()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishCellId, prometheus.GaugeValue, float64(dishC.GetCellId()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishPopRackId, prometheus.GaugeValue, float64(dishC.GetPopRackId()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishInitialSatelliteId, prometheus.GaugeValue, float64(dishC.GetInitialSatelliteId()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishInitialGatewayId, prometheus.GaugeValue, float64(dishC.GetInitialGatewayId()),
	)

	return true
}

func (e *Exporter) collectDishStatus(ch chan<- prometheus.Metric) bool {
	req := &device.Request{
		Request: &device.Request_GetStatus{},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*1)
	defer cancel()
	resp, err := e.Client.Handle(ctx, req)
	if err != nil {
		log.Errorf("failed to collect status from dish: %s", err.Error())
		return false
	}

	dishStatus := resp.GetDishGetStatus()

	ch <- prometheus.MustNewConstMetric(
		dishSecondsToFirstNonemptySlot, prometheus.GaugeValue, float64(dishStatus.GetSecondsToFirstNonemptySlot()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishPopPingDropRatio, prometheus.GaugeValue, float64(dishStatus.GetPopPingDropRate()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishPopPingLatencySeconds, prometheus.GaugeValue, float64(dishStatus.GetPopPingLatencyMs()/1000),
	)

	ch <- prometheus.MustNewConstMetric(
		dishUplinkThroughputBytes, prometheus.GaugeValue, float64(dishStatus.GetUplinkThroughputBps()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishDownlinkThroughputBytes, prometheus.GaugeValue, float64(dishStatus.GetDownlinkThroughputBps()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishBoreSightAzimuthDeg, prometheus.GaugeValue, float64(dishStatus.GetBoresightAzimuthDeg()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishBoreSightElevationDeg, prometheus.GaugeValue, float64(dishStatus.GetBoresightElevationDeg()),
	)

	return true
}

func (e *Exporter) collectDishObstructions(ch chan<- prometheus.Metric) bool {
	req := &device.Request{
		Request: &device.Request_GetStatus{},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*1)
	defer cancel()
	resp, err := e.Client.Handle(ctx, req)
	if err != nil {
		log.Errorf("failed to collect obstructions from dish: %s", err.Error())
		return false
	}

	obstructions := resp.GetDishGetStatus().GetObstructionStats()

	ch <- prometheus.MustNewConstMetric(
		dishCurrentlyObstructed, prometheus.GaugeValue, flool(obstructions.GetCurrentlyObstructed()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishFractionObstructionRatio, prometheus.GaugeValue, float64(obstructions.GetFractionObstructed()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishLast24hObstructedSeconds, prometheus.GaugeValue, float64(obstructions.GetLast_24HObstructedS()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishValidSeconds, prometheus.GaugeValue, float64(obstructions.GetValidS()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishProlongedObstructionDurationSeconds, prometheus.GaugeValue, float64(obstructions.GetAvgProlongedObstructionDurationS()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishProlongedObstructionIntervalSeconds, prometheus.GaugeValue, float64(obstructions.GetAvgProlongedObstructionIntervalS()),
	)

	for i, v := range obstructions.GetWedgeFractionObstructed() {
		ch <- prometheus.MustNewConstMetric(
			dishWedgeFractionObstructionRatio, prometheus.GaugeValue, float64(v),
			strconv.Itoa(i),
			fmt.Sprintf("%d_to_%d", i*30, (i+1)*30),
		)
	}

	for i, v := range obstructions.GetWedgeAbsFractionObstructed() {
		ch <- prometheus.MustNewConstMetric(
			dishWedgeAbsFractionObstructionRatio, prometheus.GaugeValue, float64(v),
			strconv.Itoa(i),
			fmt.Sprintf("%d_to_%d", i*30, (i+1)*30),
		)
	}

	return true
}

func (e *Exporter) collectDishAlerts(ch chan<- prometheus.Metric) bool {
	req := &device.Request{
		Request: &device.Request_GetStatus{},
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*1)
	defer cancel()
	resp, err := e.Client.Handle(ctx, req)
	if err != nil {
		log.Errorf("failed to collect alerts from dish: %s", err.Error())
		return false
	}

	alerts := resp.GetDishGetStatus().GetAlerts()

	ch <- prometheus.MustNewConstMetric(
		dishAlertMotorsStuck, prometheus.GaugeValue, flool(alerts.GetMotorsStuck()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishAlertThermalThrottle, prometheus.GaugeValue, flool(alerts.GetThermalThrottle()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishAlertThermalShutdown, prometheus.GaugeValue, flool(alerts.GetThermalShutdown()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishAlertMastNotNearVertical, prometheus.GaugeValue, flool(alerts.GetMastNotNearVertical()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishUnexpectedLocation, prometheus.GaugeValue, flool(alerts.GetUnexpectedLocation()),
	)

	ch <- prometheus.MustNewConstMetric(
		dishSlowEthernetSpeeds, prometheus.GaugeValue, flool(alerts.GetSlowEthernetSpeeds()),
	)

	return true
}

func flool(b bool) float64 {
	if b {
		return 1.00
	}
	return 0.00
}
