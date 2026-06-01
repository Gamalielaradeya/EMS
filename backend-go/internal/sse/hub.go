package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
)

const (
	EventReadingLatest    = "reading.latest"
	EventGatewayStatus    = "gateway.status"
	EventSensorTrouble    = "sensor.trouble"
	EventPredictionLatest = "prediction.latest"
	EventAnomalyCreated   = "anomaly.created"
	EventNotificationSent = "notification.sent"
	EventSystemLog        = "system.log"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: make(map[chan []byte]struct{})}
}

func (h *Hub) Publish(eventType string, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal SSE event %s: %w", eventType, err)
	}
	message := []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, payload))

	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		select {
		case client <- message:
		default:
		}
	}
	return nil
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming is unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	client := make(chan []byte, 16)
	h.mu.Lock()
	h.clients[client] = struct{}{}
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, client)
		h.mu.Unlock()
	}()

	_, _ = w.Write([]byte(": connected\n\n"))
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case message := <-client:
			if _, err := w.Write(message); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
