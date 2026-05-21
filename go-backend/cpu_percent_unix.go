//go:build !windows

package main

import (
	"math"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
)

var (
	prevCPUTimes      cpu.TimesStat
	prevCPUMutex      sync.Mutex
	prevCPUInitialized bool
)

// init pre-seeds the CPU cache at startup so the first HTTP request returns a
// meaningful delta (from boot → now) instead of zero.
func init() {
	times, err := cpu.Times(false)
	if err == nil && len(times) > 0 {
		prevCPUMutex.Lock()
		prevCPUTimes = times[0]
		prevCPUInitialized = true
		prevCPUMutex.Unlock()
	}
}

// patchCPUFreq is a no-op on non-Windows: gopsutil's cpu.Info() already reads
// the current frequency from /proc/cpuinfo (Linux) or sysctl (macOS).
func patchCPUFreq(info []cpu.InfoStat) []cpu.InfoStat {
	return info
}

// getCPUPercent returns overall CPU usage. It reads the current CPU times,
// compares them against the previously cached values, and returns the delta
// percentage. This is non-blocking — no sleep/interval is needed — and matches
// the formula used by top/htop/gopsutil (/proc/stat on Linux).
//
// The formula (standard Linux):
//
//	total    = user + nice + system + idle + iowait + irq + softirq + steal
//	busy     = total - idle - iowait
//	cpu%     = (busy₂ − busy₁) / (total₂ − total₁) × 100
//
// On macOS IO times are obtained via the host_statistics syscall (same formula).
func getCPUPercent(interval time.Duration, percpu bool) ([]float64, error) {
	if percpu {
		// For per-core, fall back to gopsutil's blocking Percent
		return cpu.Percent(interval, percpu)
	}

	current, err := cpu.Times(false)
	if err != nil {
		return nil, err
	}
	if len(current) == 0 {
		return []float64{0}, nil
	}

	cur := current[0]

	prevCPUMutex.Lock()
	defer prevCPUMutex.Unlock()

	if !prevCPUInitialized {
		prevCPUTimes = cur
		prevCPUInitialized = true
		return []float64{0}, nil
	}

	pct := calcCPUPercent(prevCPUTimes, cur)
	prevCPUTimes = cur

	if pct < 0 {
		pct = 0
	}
	if pct > 100 {
		pct = 100
	}
	return []float64{pct}, nil
}

// calcCPUPercent computes the delta CPU percentage between two TimesStat samples.
func calcCPUPercent(t1, t2 cpu.TimesStat) float64 {
	t1All, t1Busy := cpuBusy(t1)
	t2All, t2Busy := cpuBusy(t2)

	if t2Busy <= t1Busy {
		return 0
	}
	if t2All <= t1All {
		return 100
	}
	return math.Min(100, math.Max(0, (t2Busy-t1Busy)/(t2All-t1All)*100))
}

// cpuBusy returns (total, busy) from a TimesStat using the standard formula:
//
//	total = user + nice + system + idle + iowait + irq + softirq + steal
//	busy  = total - idle - iowait
//
// Guest/GuestNice are subtracted from total because the Linux kernel already
// counts them inside user/nice.
func cpuBusy(t cpu.TimesStat) (total, busy float64) {
	total = t.User + t.Nice + t.System + t.Idle + t.Iowait + t.Irq + t.Softirq + t.Steal + t.Guest + t.GuestNice
	total -= t.Guest
	total -= t.GuestNice
	busy = total - t.Idle - t.Iowait
	return
}
