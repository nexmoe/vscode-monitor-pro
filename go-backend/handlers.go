package main

import (
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
	perc, _ := getCPUPercent(1*time.Second, false)
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
	partitions, _ := disk.Partitions(false)

	usage := make([]*disk.UsageStat, 0)
	hasRoot := false
	for _, p := range partitions {
		u, err := disk.Usage(p.Mountpoint)
		if err == nil && u.Total > 0 {
			usage = append(usage, u)
			if p.Mountpoint == "/" {
				hasRoot = true
			}
		}
	}
	if runtime.GOOS != "windows" && !hasRoot {
		if u, err := disk.Usage("/"); err == nil && u.Total > 0 {
			usage = append(usage, u)
		}
	}

	ioCounters, _ := disk.IOCounters()

	writeJSON(w, Response{Success: true, Data: struct {
		Partitions []disk.PartitionStat            `json:"partitions"`
		Usage      []*disk.UsageStat               `json:"usage"`
		IOCounters map[string]disk.IOCountersStat  `json:"ioCounters"`
	}{
		Partitions: partitions,
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
		Info    *host.InfoStat              `json:"info"`
		Sensors []sensors.TemperatureStat    `json:"sensors"`
	}{
		Info:    info,
		Sensors: sensorData,
	}})
}

func getAll(w http.ResponseWriter, r *http.Request) {
	cpuInfo, _ := cpu.Info()
	cpuInfo = patchCPUFreq(cpuInfo)
	cpuPerc, _ := getCPUPercent(1*time.Second, false)
	cpuTimes, _ := cpu.Times(true)
	vmem, _ := mem.VirtualMemory()
	smem, _ := mem.SwapMemory()
	parts, _ := disk.Partitions(false)

	usage := make([]*disk.UsageStat, 0)
	hasRoot := false
	for _, p := range parts {
		u, err := disk.Usage(p.Mountpoint)
		if err == nil && u.Total > 0 {
			usage = append(usage, u)
			if p.Mountpoint == "/" {
				hasRoot = true
			}
		}
	}
	if runtime.GOOS != "windows" && !hasRoot {
		if u, err := disk.Usage("/"); err == nil && u.Total > 0 {
			usage = append(usage, u)
		}
	}

	ioCounters, _ := disk.IOCounters()
	netCounters, _ := net.IOCounters(true)
	hostInfo, _ := host.Info()
	sensorData, _ := sensors.SensorsTemperatures()
	loadAvg, _ := load.Avg()
	loadMisc, _ := load.Misc()
	batData := getBatteryData()

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
			Info    *host.InfoStat              `json:"info"`
			Sensors []sensors.TemperatureStat    `json:"sensors"`
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
