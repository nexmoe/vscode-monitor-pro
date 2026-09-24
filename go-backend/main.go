package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
)

func main() {
	// The launcher owns port selection so that every VS Code window can find the
	// shared instance through the same published port; 0 keeps the standalone
	// behaviour of picking a free port. SERVER_READY is still printed for
	// standalone use.
	port := flag.Int("port", 0, "TCP port to listen on (0 = pick a free one)")
	flag.Parse()

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

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "listen on port %d: %v\n", *port, err)
		os.Exit(1)
	}

	// Bound first so a taken port fails fast and the request cannot race the
	// sampler: the sampler warms its cache before any request is served.
	startSampler()

	actualPort := listener.Addr().(*net.TCPAddr).Port
	fmt.Printf("SERVER_READY:%d\n", actualPort)
	os.Stdout.Sync()

	_ = http.Serve(listener, mux)
}
