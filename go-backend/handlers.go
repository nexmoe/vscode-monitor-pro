package main

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime"
	"sync"
	"time"

	"github.com/distatus/battery"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/sensors"
)

const diskUsageTimeout = 2 * time.Second

const sampleWindow = 5

var (
	powerHistory     []float64
	powerHistoryMu   sync.Mutex
	lastBatteryState string
)

type batteryInfo struct {
	HasBattery bool    `json:"hasBattery"`
	State      string  `json:"state"`
	Percent    float64 `json:"percent"`
	PowerRate  float64 `json:"powerRate"`
	Health     float64 `json:"health"`
	Current    float64 `json:"current"`
	Full       float64 `json:"full"`
	Design     float64 `json:"design"`
	Voltage    float64 `json:"voltage"`
}

func getAveragePowerRate(bat *battery.Battery) float64 {
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

func getBatteryData() batteryInfo {
	batteries, _ := battery.GetAll()
	if len(batteries) == 0 {
		return batteryInfo{HasBattery: false}
	}

	bat := batteries[0]
	avgPower := getAveragePowerRate(bat)

	var signedPower float64
	switch bat.State.String() {
	case "Charging":
		signedPower = avgPower
	case "Discharging":
		signedPower = -avgPower
	default:
		signedPower = 0
	}

	percent := 0.0
	if bat.Full > 0 {
		percent = (bat.Current / bat.Full) * 100
	}

	health := 0.0
	if bat.Design > 0 {
		health = (bat.Full / bat.Design) * 100
	}

	return batteryInfo{
		HasBattery: true,
		State:      bat.State.String(),
		Percent:    percent,
		PowerRate:  signedPower,
		Health:     health,
		Current:    bat.Current,
		Full:       bat.Full,
		Design:     bat.Design,
		Voltage:    bat.Voltage,
	}
}

func usageWithTimeout(mountpoint string) *disk.UsageStat {
	type result struct {
		u *disk.UsageStat
	}
	ch := make(chan result, 1)
	go func() {
		u, err := disk.Usage(mountpoint)
		if err == nil && u.Total > 0 {
			ch <- result{u}
		}
		close(ch)
	}()
	select {
	case r := <-ch:
		return r.u
	case <-time.After(diskUsageTimeout):
		return nil
	}
}

func partitionsWithTimeout(timeout time.Duration) []disk.PartitionStat {
	type result struct {
		p []disk.PartitionStat
	}
	ch := make(chan result, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		p, _ := disk.PartitionsWithContext(ctx, false)
		ch <- result{p}
	}()
	select {
	case r := <-ch:
		return r.p
	case <-time.After(timeout + time.Second):
		return nil
	}
}

func ioCountersWithTimeout(timeout time.Duration) map[string]disk.IOCountersStat {
	type result struct {
		m map[string]disk.IOCountersStat
	}
	ch := make(chan result, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		m, _ := disk.IOCountersWithContext(ctx)
		ch <- result{m}
	}()
	select {
	case r := <-ch:
		return r.m
	case <-time.After(timeout + time.Second):
		return nil
	}
}

func getBattery(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, Response{Success: true, Data: getBatteryData()})
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, Response{Success: true, Data: "ok"})
}

func getBasicMetrics(w http.ResponseWriter, r *http.Request) {
	cpuPercents, _ := getCPUPercent(1, false)
	vm, _ := mem.VirtualMemory()

	var cpuPct float64
	if len(cpuPercents) > 0 {
		cpuPct = cpuPercents[0]
	}

	writeJSON(w, Response{Success: true, Data: map[string]interface{}{
		"cpuPercent":   cpuPct,
		"memPercent":   vm.UsedPercent,
		"memTotal":     vm.Total,
		"memUsed":      vm.Used,
		"memFree":      vm.Free,
		"memAvailable": vm.Available,
		"memBuffCache": vm.Buffers + vm.Cached,
	}})
}

func getCPU(w http.ResponseWriter, r *http.Request) {
	info, _ := cpu.Info()
	info = patchCPUFreq(info)
	perc, _ := getCPUPercent(2*time.Second, false)
	times, _ := cpu.Times(true)

	writeJSON(w, Response{Success: true, Data: struct {
		Info    []cpu.InfoStat  `json:"info"`
		Percent []float64       `json:"percent"`
		Times   []cpu.TimesStat `json:"times"`
	}{
		Info:    info,
		Percent: perc,
		Times:   times,
	}})
}

func getMemory(w http.ResponseWriter, r *http.Request) {
	vmem, _ := mem.VirtualMemory()
	smem, _ := mem.SwapMemory()

	writeJSON(w, Response{Success: true, Data: struct {
		Virtual *mem.VirtualMemoryStat `json:"virtual"`
		Swap    *mem.SwapMemoryStat    `json:"swap"`
	}{
		Virtual: vmem,
		Swap:    smem,
	}})
}

func getDisk(w http.ResponseWriter, r *http.Request) {
	partitions := partitionsWithTimeout(10 * time.Second)

	usage := make([]*disk.UsageStat, 0)
	validParts := make([]disk.PartitionStat, 0, len(partitions))
	hasRoot := false
	for _, p := range partitions {
		u := usageWithTimeout(p.Mountpoint)
		if u != nil {
			usage = append(usage, u)
			validParts = append(validParts, p)
			if p.Mountpoint == "/" {
				hasRoot = true
			}
		}
	}
	if runtime.GOOS != "windows" && !hasRoot {
		if u := usageWithTimeout("/"); u != nil {
			usage = append(usage, u)
		}
	}

	ioCounters := ioCountersWithTimeout(2 * time.Second)

	writeJSON(w, Response{Success: true, Data: struct {
		Partitions []disk.PartitionStat           `json:"partitions"`
		Usage      []*disk.UsageStat              `json:"usage"`
		IOCounters map[string]disk.IOCountersStat `json:"ioCounters"`
	}{
		Partitions: validParts,
		Usage:      usage,
		IOCounters: ioCounters,
	}})
}

func getNetwork(w http.ResponseWriter, r *http.Request) {
	counters, _ := net.IOCounters(true)

	writeJSON(w, Response{Success: true, Data: struct {
		IOCounters []net.IOCountersStat `json:"ioCounters"`
	}{
		IOCounters: counters,
	}})
}

func getHost(w http.ResponseWriter, r *http.Request) {
	info, _ := host.Info()
	sensorData, _ := sensors.SensorsTemperatures()

	writeJSON(w, Response{Success: true, Data: struct {
		Info    *host.InfoStat            `json:"info"`
		Sensors []sensors.TemperatureStat `json:"sensors"`
	}{
		Info:    info,
		Sensors: sensorData,
	}})
}

func getAll(w http.ResponseWriter, r *http.Request) {
	var (
		mu sync.Mutex
		wg sync.WaitGroup

		cpuInfo     []cpu.InfoStat
		cpuPerc     []float64
		cpuTimes    []cpu.TimesStat
		vmem        *mem.VirtualMemoryStat
		smem        *mem.SwapMemoryStat
		parts       []disk.PartitionStat
		usage       []*disk.UsageStat
		ioCounters  map[string]disk.IOCountersStat
		netCounters []net.IOCountersStat
		hostInfo    *host.InfoStat
		sensorData  []sensors.TemperatureStat
		loadAvg     *load.AvgStat
		loadMisc    *load.MiscStat
		batData     batteryInfo
	)

	// CPU group
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		info, _ := cpu.InfoWithContext(ctx)
		info = patchCPUFreq(info)
		perc, _ := getCPUPercent(2*time.Second, false)
		times, _ := cpu.TimesWithContext(ctx, true)

		mu.Lock()
		cpuInfo = info
		cpuPerc = perc
		cpuTimes = times
		mu.Unlock()
	}()

	// Memory group
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		virtual, _ := mem.VirtualMemoryWithContext(ctx)
		swap, _ := mem.SwapMemoryWithContext(ctx)

		mu.Lock()
		vmem = virtual
		smem = swap
		mu.Unlock()
	}()

	// Disk group
	wg.Add(1)
	go func() {
		defer wg.Done()

		partitions := partitionsWithTimeout(10 * time.Second)

		diskUsage := make([]*disk.UsageStat, 0)
		validParts := make([]disk.PartitionStat, 0, len(partitions))
		hasRoot := false
		for _, p := range partitions {
			u := usageWithTimeout(p.Mountpoint)
			if u != nil {
				diskUsage = append(diskUsage, u)
				validParts = append(validParts, p)
				if p.Mountpoint == "/" {
					hasRoot = true
				}
			}
		}
		if runtime.GOOS != "windows" && !hasRoot {
			if u := usageWithTimeout("/"); u != nil {
				diskUsage = append(diskUsage, u)
			}
		}

		ioMap := ioCountersWithTimeout(2 * time.Second)

		mu.Lock()
		parts = validParts
		usage = diskUsage
		ioCounters = ioMap
		mu.Unlock()
	}()

	// Network group
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		counters, _ := net.IOCountersWithContext(ctx, true)

		mu.Lock()
		netCounters = counters
		mu.Unlock()
	}()

	// Host group
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		info, _ := host.InfoWithContext(ctx)
		sensors, _ := sensors.TemperaturesWithContext(ctx)

		mu.Lock()
		hostInfo = info
		sensorData = sensors
		mu.Unlock()
	}()

	// Load group
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		avg, _ := load.AvgWithContext(ctx)
		misc, _ := load.MiscWithContext(ctx)

		mu.Lock()
		loadAvg = avg
		loadMisc = misc
		mu.Unlock()
	}()

	// Battery group
	wg.Add(1)
	go func() {
		defer wg.Done()
		data := getBatteryData()
		mu.Lock()
		batData = data
		mu.Unlock()
	}()

	wg.Wait()

	writeJSON(w, Response{Success: true, Data: struct {
		CPU     interface{} `json:"cpu"`
		Memory  interface{} `json:"memory"`
		Disk    interface{} `json:"disk"`
		Network interface{} `json:"network"`
		Host    interface{} `json:"host"`
		Load    interface{} `json:"load"`
		Battery batteryInfo `json:"battery"`
	}{
		CPU: struct {
			Info    []cpu.InfoStat  `json:"info"`
			Percent []float64       `json:"percent"`
			Times   []cpu.TimesStat `json:"times"`
		}{
			Info: cpuInfo, Percent: cpuPerc, Times: cpuTimes,
		},
		Memory: struct {
			Virtual *mem.VirtualMemoryStat `json:"virtual"`
			Swap    *mem.SwapMemoryStat    `json:"swap"`
		}{
			Virtual: vmem, Swap: smem,
		},
		Disk: struct {
			Partitions []disk.PartitionStat           `json:"partitions"`
			Usage      []*disk.UsageStat              `json:"usage"`
			IOCounters map[string]disk.IOCountersStat `json:"ioCounters"`
		}{
			Partitions: parts, Usage: usage, IOCounters: ioCounters,
		},
		Network: struct {
			IOCounters []net.IOCountersStat `json:"ioCounters"`
		}{
			IOCounters: netCounters,
		},
		Host: struct {
			Info    *host.InfoStat            `json:"info"`
			Sensors []sensors.TemperatureStat `json:"sensors"`
		}{
			Info: hostInfo, Sensors: sensorData,
		},
		Load: struct {
			Avg  *load.AvgStat  `json:"avg"`
			Misc *load.MiscStat `json:"misc"`
		}{
			Avg: loadAvg, Misc: loadMisc,
		},
		Battery: batData,
	}})
}
