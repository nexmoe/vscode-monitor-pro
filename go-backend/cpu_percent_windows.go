//go:build windows

package main

import (
	"fmt"
	"syscall"
	"time"
	"unsafe"

	"github.com/shirou/gopsutil/v4/cpu"
)

var (
	modpdh                        = syscall.NewLazyDLL("pdh.dll")
	_PdhOpenQuery                 = modpdh.NewProc("PdhOpenQuery")
	_PdhAddEnglishCounter         = modpdh.NewProc("PdhAddEnglishCounterW")
	_PdhAddCounter                = modpdh.NewProc("PdhAddCounterW")
	_PdhCollectQueryData          = modpdh.NewProc("PdhCollectQueryData")
	_PdhGetFormattedCounterValue  = modpdh.NewProc("PdhGetFormattedCounterValue")
	_PdhCloseQuery                = modpdh.NewProc("PdhCloseQuery")
)

const (
	pdhFmtDouble = 0x00000200
	errorSuccess = 0
)

// patchCPUFreq replaces static MHz values from cpu.Info() with the current
// real-time frequency read via PDH. This makes the CPU speed indicator in
// resource-usage views dynamic instead of showing a fixed nominal value.
//
// It reads \Processor Information(_Total)\% Processor Performance which
// expresses the current frequency as a percentage of the base frequency, then
// computes: current MHz = base MHz × (performance% / 100).
func patchCPUFreq(info []cpu.InfoStat) []cpu.InfoStat {
	if len(info) == 0 {
		return info
	}

	pct, err := pdhQueryCounter(`\Processor Information(_Total)\% Processor Performance`)
	if err != nil {
		return info
	}
	if pct <= 0 {
		return info
	}

	baseMHz := info[0].Mhz
	if baseMHz <= 0 {
		return info
	}

	curMHz := baseMHz * (pct / 100.0)
	out := make([]cpu.InfoStat, len(info))
	for i, v := range info {
		out[i] = v
		out[i].Mhz = curMHz
	}
	return out
}

// pdhFmtCounterValueDouble matches Windows PDH_FMT_COUNTERVALUE_DOUBLE exactly.
// DWORD (4 bytes) + padding (4 bytes for 8-byte alignment of double) + double (8 bytes)
type pdhFmtCounterValueDouble struct {
	CStatus     uint32
	_           uint32
	DoubleValue float64
}

// getCPUPercent returns CPU usage matching Windows Task Manager via PDH API.
// Only the PDH \Processor Information(_Total)\% Processor Utility counter is used,
// which is the same source Windows Task Manager reads from (Win8+).
// Interval and percpu parameters are ignored on Windows — PDH returns instant
// system-wide CPU utilization without blocking.
func getCPUPercent(time.Duration, bool) ([]float64, error) {
	val, err := pdhGetCPUPercent()
	if err != nil {
		return nil, err
	}
	if val < 0 {
		val = 0
	}
	if val > 100 {
		val = 100
	}
	return []float64{val}, nil
}

func pdhGetCPUPercent() (float64, error) {
	// Try the Task-Marker-matching counter first (Win8+), fall back to the classic
	for _, path := range []string{
		`\Processor Information(_Total)\% Processor Utility`,
		`\Processor(_Total)\% Processor Time`,
	} {
		val, err := pdhQueryCounter(path)
		if err == nil {
			return val, nil
		}
	}
	return 0, fmt.Errorf("all PDH CPU counters failed")
}

func pdhQueryCounter(counterPath string) (float64, error) {
	var query uintptr
	ret, _, _ := _PdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query)))
	if ret != errorSuccess {
		return 0, fmt.Errorf("PdhOpenQuery: 0x%x", uint32(ret))
	}
	defer _PdhCloseQuery.Call(query)

	pathPtr, err := syscall.UTF16PtrFromString(counterPath)
	if err != nil {
		return 0, fmt.Errorf("UTF16PtrFromString: %w", err)
	}

	var counter uintptr
	ret, _, _ = _PdhAddEnglishCounter.Call(
		query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&counter)),
	)
	if ret != errorSuccess {
		// Fallback to locale-specific counter if English API is unavailable
		ret, _, _ = _PdhAddCounter.Call(
			query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&counter)),
		)
		if ret != errorSuccess {
			return 0, fmt.Errorf("PdhAddCounter[%s]: 0x%x", counterPath, uint32(ret))
		}
	}

	// Two collections required for rate-type counters
	_PdhCollectQueryData.Call(query)
	_PdhCollectQueryData.Call(query)

	var value pdhFmtCounterValueDouble
	ret, _, _ = _PdhGetFormattedCounterValue.Call(
		counter, pdhFmtDouble, 0, uintptr(unsafe.Pointer(&value)),
	)
	if ret != errorSuccess {
		return 0, fmt.Errorf("PdhGetFormattedCounterValue: 0x%x", uint32(ret))
	}

	return value.DoubleValue, nil
}
