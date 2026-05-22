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

type pdhFmtCounterValueDouble struct {
	CStatus     uint32
	_           uint32
	DoubleValue float64
}

// cpuMonitor 持有一个常驻 PDH 查询句柄
// 对应 TrafficMonitor 的 CPdhQuery：构造时 Open+AddCounter+初始基线采集，
// 每次 QueryValue 只做一次 CollectQueryData + GetFormattedCounterValue
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
		var query uintptr
		ret, _, _ := _PdhOpenQuery.Call(0, 0, uintptr(unsafe.Pointer(&query)))
		if ret != errorSuccess {
			cpuMonErr = fmt.Errorf("PdhOpenQuery: 0x%x", uint32(ret))
			return
		}

		// Step 1: 先尝试 Win8+ 任务管理器同源计数器，失败则回退到经典计数器
		// 对应 TrafficMonitor CPdhCPUUsage 构造时根据系统版本选择计数器
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

		// Step 2: 初始基线采集
		// 对应 TrafficMonitor PdhQuery::Initialize() 最后的 PdhCollectQueryData
		_PdhCollectQueryData.Call(query)

		cpuMon.query = query
		cpuMon.counter = counter
		cpuMon.ok = true
	})
	return cpuMonErr
}

// collect 每次采集一个新样本，PDH 基于与基线（或前一次采集）的差值计算使用率
// 对应 TrafficMonitor PdhQuery::QueryValue 的 Collect + GetFormattedCounterValue
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

// getCPUPercent 保持与 unix 版一致的签名，interval/percpu 在 Windows 上忽略
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

// patchCPUFreq 替换 cpu.Info() 的静态 MHz 为实时 PDH 频率数值
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

// pdhReadCounter 一次性查询 PDH 计数器（用于 patchCPUFreq 等低频查询，非 CPU 使用率路径）
// 瞬时计数器只需一次 PdhCollectQueryData
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

	// 部分内核模式提供程序（如 Processor Information）需要一次预热采集才能返回有效数据，因此这里必须采集两次，无时间间隔要求
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
