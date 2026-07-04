package service

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type TelegramSender interface {
	Send(ctx context.Context, botToken, chatID, message string) error
}

type TelegramClient struct {
	baseURL string
	client  *http.Client
}

func NewTelegramClient(baseURL string) *TelegramClient {
	return &TelegramClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *TelegramClient) Send(ctx context.Context, botToken, chatID, message string) error {
	endpoint := c.baseURL + "/bot" + botToken + "/sendMessage"
	form := url.Values{"chat_id": {chatID}, "text": {message}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("create Telegram request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := c.client.Do(request)
	if err != nil {
		return fmt.Errorf("send Telegram request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("Telegram API returned status %d", response.StatusCode)
	}
	return nil
}
