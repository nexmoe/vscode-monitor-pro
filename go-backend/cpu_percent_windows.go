//go:build windows

package main

import (
	"fmt"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/shirou/gopsutil/v4/cpu"
)

var (
	modpdh                       = syscall.NewLazyDLL("pdh.dll")
	_PdhOpenQuery                = modpdh.NewProc("PdhOpenQuery")
	_PdhAddEnglishCounter        = modpdh.NewProc("PdhAddEnglishCounterW")
	_PdhAddCounter               = modpdh.NewProc("PdhAddCounterW")
	_PdhCollectQueryData         = modpdh.NewProc("PdhCollectQueryData")
	_PdhGetFormattedCounterValue = modpdh.NewProc("PdhGetFormattedCounterValue")
	_PdhCloseQuery               = modpdh.NewProc("PdhCloseQuery")
)

const (
	pdhFmtDouble = 0x00000200
	errorSuccess = 0
)

type pdhFmtCounterValueDouble struct {
	CStatus     uint32
	_           uint32
	DoubleValue float64
}

// cpuMonitor holds a persistent PDH query handle.
// Mirrors TrafficMonitor's CPdhQuery: open + add counter + baseline collection at construction,
// and each QueryValue only calls CollectQueryData + GetFormattedCounterValue once.
type cpuMonitor struct {
	mu      sync.Mutex
	query   uintptr
	counter uintptr
	ok      bool
}

var (
	cpuMon    cpuMonitor
	cpuMonErr error
	cpuMonSet sync.Once
)

func initCPU() error {
	cpuMonSet.Do(func() {
		done := make(chan struct{})
		go func() {
			defer close(done)

			var query uintptr
			ret, _, _ := _PdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query)))
			if ret != errorSuccess {
				cpuMonErr = fmt.Errorf("PdhOpenQuery: 0x%x", uint32(ret))
				return
			}

			var counter uintptr
			for _, path := range []string{
				`\Processor Information(_Total)\% Processor Utility`,
				`\Processor(_Total)\% Processor Time`,
			} {
				pathPtr, err := syscall.UTF16PtrFromString(path)
				if err != nil {
					continue
				}
				ret, _, _ = _PdhAddEnglishCounter.Call(
					query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&counter)),
				)
				if ret != errorSuccess {
					ret, _, _ = _PdhAddCounter.Call(
						query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&counter)),
					)
				}
				if ret == errorSuccess {
					break
				}
			}
			if ret != errorSuccess {
				_PdhCloseQuery.Call(query)
				cpuMonErr = fmt.Errorf("all PDH CPU counters failed")
				return
			}

			_PdhCollectQueryData.Call(query)

			cpuMon.query = query
			cpuMon.counter = counter
			cpuMon.ok = true
		}()

		select {
		case <-done:
		case <-time.After(2 * time.Second):
			cpuMonErr = fmt.Errorf("PDH init timed out after 2s")
		}
	})
	return cpuMonErr
}

// collect takes a new sample each time; PDH computes usage from the delta against the baseline (or previous sample).
// Mirrors TrafficMonitor PdhQuery::QueryValue's Collect + GetFormattedCounterValue.
func (m *cpuMonitor) collect() (float64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.ok {
		return 0, fmt.Errorf("PDH CPU monitor not initialized")
	}

	_PdhCollectQueryData.Call(m.query)

	var value pdhFmtCounterValueDouble
	ret, _, _ := _PdhGetFormattedCounterValue.Call(
		m.counter, pdhFmtDouble, 0, uintptr(unsafe.Pointer(&value)),
	)
	if ret != errorSuccess {
		return 0, fmt.Errorf("PdhGetFormattedCounterValue: 0x%x", uint32(ret))
	}

	return value.DoubleValue, nil
}

// getCPUPercent keeps the same signature as the Unix version; interval/percpu are ignored on Windows.
func getCPUPercent(_ time.Duration, _ bool) ([]float64, error) {
	if err := initCPU(); err != nil {
		return nil, err
	}
	val, err := cpuMon.collect()
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

// patchCPUFreq replaces the static MHz from cpu.Info() with the real-time PDH frequency value.
func patchCPUFreq(info []cpu.InfoStat) []cpu.InfoStat {
	if len(info) == 0 {
		return info
	}
	val, err := pdhReadCounter(`\Processor Information(_Total)\% Processor Performance`)
	if err != nil {
		return info
	}
	if val <= 0 {
		return info
	}

	baseMHz := info[0].Mhz
	if baseMHz <= 0 {
		return info
	}

	curMHz := baseMHz * (val / 100.0)
	out := make([]cpu.InfoStat, len(info))
	for i, v := range info {
		out[i] = v
		out[i].Mhz = curMHz
	}
	return out
}

// pdhReadCounter performs a one-off PDH counter query (used for low-frequency queries such as patchCPUFreq, not the CPU usage path).
// Instantaneous counters only need a single PdhCollectQueryData.
func pdhReadCounter(counterPath string) (float64, error) {
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
		ret, _, _ = _PdhAddCounter.Call(
			query, uintptr(unsafe.Pointer(pathPtr)), 0, uintptr(unsafe.Pointer(&counter)),
		)
		if ret != errorSuccess {
			return 0, fmt.Errorf("PdhAddCounter[%s]: 0x%x", counterPath, uint32(ret))
		}
	}

	// Some kernel-mode providers (e.g., Processor Information) require a warm-up sample before returning valid data, so we must collect twice here; no delay is required between them.
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