package repository

import "testing"

func TestShouldCreateTransition(t *testing.T) {
	waspada := "waspada"
	anomali := "anomali"
	tests := []struct {
		name     string
		previous *string
		current  string
		expected bool
	}{
		{name: "initial normal is ignored", current: "normal", expected: false},
		{name: "initial warning creates event", current: "waspada", expected: true},
		{name: "repeated warning is ignored", previous: &waspada, current: "waspada", expected: false},
		{name: "warning escalates to anomaly", previous: &waspada, current: "anomali", expected: true},
		{name: "anomaly recovers to normal", previous: &anomali, current: "normal", expected: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := shouldCreateTransition(test.previous, test.current); actual != test.expected {
				t.Fatalf("expected %t, got %t", test.expected, actual)
			}
		})
	}
}
