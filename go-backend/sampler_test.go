package main

import (
	"os"
	"sync"
	"testing"

	"github.com/distatus/battery"
)

// The handlers only read the sampler cache, so every test needs it warm.
func TestMain(m *testing.M) {
	startSampler()
	os.Exit(m.Run())
}

func TestSamplerPublishesCPURange(t *testing.T) {
	got := currentCPUPercent()
	if got < 0 || got > 100 {
		t.Fatalf("sampled cpu percent out of range: %f", got)
	}
}

func TestSamplerWithoutBatteryPublishesZero(t *testing.T) {
	batteries, err := battery.GetAll()
	if err == nil && len(batteries) > 0 {
		t.Skip("machine has a battery; the sign depends on its state")
	}

	setBatteryWatts(-1)
	refreshSamples()
	if got := currentBatteryWatts(); got != 0 {
		t.Fatalf("expected 0 without a battery, got %f", got)
	}
}

// The cache is read by every request while the sampler keeps writing it.
func TestSamplerCacheIsSafeForConcurrentReaders(t *testing.T) {
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				if v := currentCPUPercent(); v < 0 || v > 100 {
					t.Errorf("cpu percent out of range: %f", v)
					return
				}
			}
		}()
	}
	wg.Wait()
}
