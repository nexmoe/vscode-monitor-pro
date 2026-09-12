package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func checkSuccess(t *testing.T, body []byte) {
	var resp Response
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if !resp.Success {
		t.Fatal("expected Success: true")
	}
	if resp.Data == nil {
		t.Fatal("expected Data to be non-nil")
	}
}

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	healthCheck(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Fatalf("expected application/json, got %s", ct)
	}

	var body struct {
		Success bool   `json:"success"`
		Data    string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("JSON decode error: %v", err)
	}
	if !body.Success {
		t.Fatal("expected success=true")
	}
	if body.Data != "ok" {
		t.Fatalf("expected data='ok', got '%s'", body.Data)
	}
}

func TestBasicMetricsHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/basic", nil)
	w := httptest.NewRecorder()
	getBasicMetrics(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			CPUPct      float64 `json:"cpuPercent"`
			MemPct      float64 `json:"memPercent"`
			MemTotal    uint64  `json:"memTotal"`
			MemUsed     uint64  `json:"memUsed"`
			MemFree     uint64  `json:"memFree"`
			MemAvail    uint64  `json:"memAvailable"`
			MemBufCache uint64  `json:"memBuffCache"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if parsed.Data.CPUPct < 0 || parsed.Data.CPUPct > 100 {
		t.Fatalf("cpuPercent out of range: %f", parsed.Data.CPUPct)
	}
	if parsed.Data.MemTotal == 0 {
		t.Fatal("memTotal should not be 0")
	}
}

func TestCPUHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/cpu", nil)
	w := httptest.NewRecorder()
	getCPU(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			Info    json.RawMessage `json:"info"`
			Percent json.RawMessage `json:"percent"`
			Times   json.RawMessage `json:"times"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)

	if strings.Contains(string(parsed.Data.Info), "modelName") == false {
		t.Fatal("cpu.info missing modelName field")
	}
}

func TestMemoryHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/memory", nil)
	w := httptest.NewRecorder()
	getMemory(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			Virtual json.RawMessage `json:"virtual"`
			Swap    json.RawMessage `json:"swap"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if len(parsed.Data.Virtual) == 0 {
		t.Fatal("memory.virtual should not be empty")
	}
}

func TestDiskHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/disk", nil)
	w := httptest.NewRecorder()
	getDisk(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			Partitions json.RawMessage `json:"partitions"`
			Usage      json.RawMessage `json:"usage"`
			IOCounters json.RawMessage `json:"ioCounters"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if len(parsed.Data.Partitions) == 0 {
		t.Fatal("disk.partitions should not be empty")
	}
}

func TestNetworkHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/network", nil)
	w := httptest.NewRecorder()
	getNetwork(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			IOCounters json.RawMessage `json:"ioCounters"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if len(parsed.Data.IOCounters) == 0 {
		t.Fatal("network.ioCounters should not be empty")
	}
}

func TestHostHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/host", nil)
	w := httptest.NewRecorder()
	getHost(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			Info    json.RawMessage `json:"info"`
			Sensors json.RawMessage `json:"sensors"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if len(parsed.Data.Info) == 0 {
		t.Fatal("host.info should not be empty")
	}
	var info struct {
		Hostname string `json:"hostname"`
		OS       string `json:"os"`
		Platform string `json:"platform"`
	}
	json.Unmarshal(parsed.Data.Info, &info)
	if info.Hostname == "" {
		t.Fatal("host.info.hostname should not be empty")
	}
	if info.OS == "" {
		t.Fatal("host.info.os should not be empty")
	}
}

func TestAllHandler(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/all", nil)
	w := httptest.NewRecorder()
	getAll(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body := readBody(t, resp)
	checkSuccess(t, body)

	var parsed struct {
		Success bool `json:"success"`
		Data    struct {
			CPU     json.RawMessage `json:"cpu"`
			Memory  json.RawMessage `json:"memory"`
			Disk    json.RawMessage `json:"disk"`
			Network json.RawMessage `json:"network"`
			Host    json.RawMessage `json:"host"`
		} `json:"data"`
	}
	mustUnmarshal(t, body, &parsed)
	if len(parsed.Data.CPU) == 0 {
		t.Fatal("all.cpu should not be empty")
	}
	if len(parsed.Data.Memory) == 0 {
		t.Fatal("all.memory should not be empty")
	}
	if len(parsed.Data.Host) == 0 {
		t.Fatal("all.host should not be empty")
	}
}

func readBody(t *testing.T, resp *http.Response) []byte {
	t.Helper()
	var buf strings.Builder
	const bufSize = 512
	for {
		b := make([]byte, bufSize)
		n, err := resp.Body.Read(b)
		if n > 0 {
			buf.Write(b[:n])
		}
		if err != nil {
			break
		}
	}
	resp.Body.Close()
	return []byte(buf.String())
}

func mustUnmarshal(t *testing.T, data []byte, v interface{}) {
	t.Helper()
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("JSON unmarshal: %v\nbody: %s", err, string(data))
	}
}
