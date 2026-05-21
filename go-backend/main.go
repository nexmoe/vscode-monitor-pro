package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheck)
	mux.HandleFunc("/api/v1/basic", getBasicMetrics)
	mux.HandleFunc("/api/v1/cpu", getCPU)
	mux.HandleFunc("/api/v1/memory", getMemory)
	mux.HandleFunc("/api/v1/disk", getDisk)
	mux.HandleFunc("/api/v1/network", getNetwork)
	mux.HandleFunc("/api/v1/host", getHost)
	mux.HandleFunc("/api/v1/battery", getBattery)
	mux.HandleFunc("/api/v1/all", getAll)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		os.Exit(1)
	}

	port := listener.Addr().(*net.TCPAddr).Port
	fmt.Printf("SERVER_READY:%d\n", port)
	os.Stdout.Sync()

	_ = http.Serve(listener, mux)
}
