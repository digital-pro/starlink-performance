package exporter

import (
	"context"
	"math"
	"sync"
	"time"

	"github.com/danopstech/starlink_exporter/pkg/spacex.com/api/device"
	log "github.com/sirupsen/logrus"
)

type historySnapshot struct {
	DownSupported bool
	DownAvg5s     float64
	DownAvg10s    float64
	DownAvg15s    float64

	UpSupported bool
	UpAvg5s     float64
	UpAvg10s    float64
	UpAvg15s    float64
}

type historySampler struct {
	client device.DeviceClient
	mu     sync.RWMutex
	data   historySnapshot
	ready  bool
}

func newHistorySampler(client device.DeviceClient) *historySampler {
	hs := &historySampler{client: client}
	go hs.run()
	return hs
}

func (h *historySampler) run() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		h.collect()
		<-ticker.C
	}
}

func (h *historySampler) collect() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

    resp, err := h.client.Handle(ctx, &device.Request{
		Request: &device.Request_GetHistory{
			GetHistory: &device.GetHistoryRequest{},
		},
	})
	if err != nil {
		log.WithError(err).Debug("history sampler: failed to collect history")
		return
	}

    history := resp.GetDishGetHistory()
	if history == nil {
		return
	}

	snap := historySnapshot{}

	if down := history.GetDownlinkThroughputBps(); len(down) > 0 {
		snap.DownSupported = true
		snap.DownAvg5s = averageLast(down, 5)
		snap.DownAvg10s = averageLast(down, 10)
		snap.DownAvg15s = averageLast(down, 15)
	}

	if up := history.GetUplinkThroughputBps(); len(up) > 0 {
		snap.UpSupported = true
		snap.UpAvg5s = averageLast(up, 5)
		snap.UpAvg10s = averageLast(up, 10)
		snap.UpAvg15s = averageLast(up, 15)
	}

	h.mu.Lock()
	h.data = snap
	h.ready = true
	h.mu.Unlock()
}

func (h *historySampler) snapshot() (historySnapshot, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if !h.ready {
		return historySnapshot{}, false
	}
	return h.data, true
}

func averageLast(samples []float32, window int) float64 {
	if len(samples) == 0 {
		return math.NaN()
	}
	if window > len(samples) {
		window = len(samples)
	}
	sum := 0.0
	start := len(samples) - window
	for i := start; i < len(samples); i++ {
		sum += float64(samples[i])
	}
	return sum / float64(window)
}

