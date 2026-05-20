package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"testing"
)

func TestServerStartupAndAPIs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheck)
	mux.HandleFunc("/api/v1/basic", getBasicMetrics)
	mux.HandleFunc("/api/v1/cpu", getCPU)
	mux.HandleFunc("/api/v1/memory", getMemory)
	mux.HandleFunc("/api/v1/disk", getDisk)
	mux.HandleFunc("/api/v1/network", getNetwork)
	mux.HandleFunc("/api/v1/host", getHost)
	mux.HandleFunc("/api/v1/all", getAll)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	go http.Serve(listener, mux)

	base := fmt.Sprintf("http://127.0.0.1:%d", port)

	tests := []struct {
		name string
		path string
	}{
		{"health", "/health"},
		{"basic", "/api/v1/basic"},
		{"cpu", "/api/v1/cpu"},
		{"memory", "/api/v1/memory"},
		{"disk", "/api/v1/disk"},
		{"network", "/api/v1/network"},
		{"host", "/api/v1/host"},
		{"all", "/api/v1/all"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := http.Get(base + tt.path)
			if err != nil {
				t.Fatalf("GET %s: %v", tt.path, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				t.Fatalf("expected 200, got %d", resp.StatusCode)
			}
			if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
				t.Fatalf("expected application/json, got %s", ct)
			}

			var result Response
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				t.Fatalf("JSON decode: %v", err)
			}
			if !result.Success {
				t.Fatal("expected success=true")
			}
			if result.Data == nil {
				t.Fatal("expected non-nil data")
			}
		})
	}
}
