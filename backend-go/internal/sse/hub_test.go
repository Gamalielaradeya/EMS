package sse

import (
	"strings"
	"testing"
)

func TestPublishFormatsSSEEvent(t *testing.T) {
	hub := NewHub()
	client := make(chan []byte, 1)
	hub.clients[client] = struct{}{}

	if err := hub.Publish(EventReadingLatest, map[string]string{"sensor_code": "S1"}); err != nil {
		t.Fatalf("publish event: %v", err)
	}

	message := string(<-client)
	if !strings.Contains(message, "event: reading.latest") {
		t.Fatalf("missing event type in %q", message)
	}
	if !strings.Contains(message, `"sensor_code":"S1"`) {
		t.Fatalf("missing payload in %q", message)
	}
}
