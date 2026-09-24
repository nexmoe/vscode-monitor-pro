package main

import (
	"sync"
	"time"

	"github.com/distatus/battery"
)

// One backend process serves every VS Code window, so metrics that are derived
// from the request pattern must not be computed inside a request: CPU usage is
// a delta between two observations and battery power is a rolling window, so
// interleaved requests from N windows would each measure a shorter interval and
// disagree with each other. The sampler refreshes both on a fixed cadence and
// the handlers only read the cached values.
const (
	samplerInterval = time.Second
	// The CPU sources establish their baseline on the first call, so a second
	// call after a short warm-up is needed to publish a real delta instead of 0.
	samplerWarmup = 250 * time.Millisecond
	// Rolling window over battery charge-rate samples, kept from the previous
	// per-request behaviour (5 samples, now one per sampler tick).
	sampleWindow = 5
)

var (
	metricsMu    sync.RWMutex
	cpuPercent   float64
	batteryWatts float64

	powerHistory     []float64
	powerHistoryMu   sync.Mutex
	lastBatteryState string
)

// startSampler seeds the cache synchronously, so the first request after
// startup already gets a real value, then keeps it fresh in the background.
func startSampler() {
	refreshSamples()
	time.Sleep(samplerWarmup)
	refreshSamples()

	go func() {
		for range time.NewTicker(samplerInterval).C {
			refreshSamples()
		}
	}()
}

func refreshSamples() {
	// A failed sample keeps the previous value rather than publishing a zero.
	if perc, err := getCPUPercent(0, false); err == nil && len(perc) > 0 {
		setCPUPercent(perc[0])
	}
	setBatteryWatts(sampleBatteryWatts())
}

// sampleBatteryWatts advances the rolling window and returns signed net power:
// positive while charging, negative while discharging, 0 otherwise.
func sampleBatteryWatts() float64 {
	batteries, err := battery.GetAll()
	if err != nil || len(batteries) == 0 {
		return 0
	}

	bat := batteries[0]
	avg := averagePowerRate(bat)

	switch bat.State.String() {
	case "Charging":
		return avg
	case "Discharging":
		return -avg
	default:
		return 0
	}
}

// averagePowerRate appends the battery's current charge rate to the rolling
// window and returns the average of the window. The window is reset when the
// battery switches between charging and discharging, so the average never
// mixes the two states.
func averagePowerRate(bat *battery.Battery) float64 {
	powerHistoryMu.Lock()
	defer powerHistoryMu.Unlock()

	currentState := bat.State.String()
	if currentState != lastBatteryState && (currentState == "Charging" || currentState == "Discharging") {
		powerHistory = nil
		lastBatteryState = currentState
	}

	rate := bat.ChargeRate / 1000
	powerHistory = append(powerHistory, rate)
	if len(powerHistory) > sampleWindow {
		powerHistory = powerHistory[1:]
	}

	var sum float64
	for _, r := range powerHistory {
		sum += r
	}
	if len(powerHistory) == 0 {
		return 0
	}
	return sum / float64(len(powerHistory))
}

func setCPUPercent(v float64) {
	metricsMu.Lock()
	cpuPercent = v
	metricsMu.Unlock()
}

func setBatteryWatts(v float64) {
	metricsMu.Lock()
	batteryWatts = v
	metricsMu.Unlock()
}

// currentCPUPercent returns the last sampled overall CPU usage.
func currentCPUPercent() float64 {
	metricsMu.RLock()
	defer metricsMu.RUnlock()
	return cpuPercent
}

// currentBatteryWatts returns the last sampled battery net power.
func currentBatteryWatts() float64 {
	metricsMu.RLock()
	defer metricsMu.RUnlock()
	return batteryWatts
}
