package llmclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type InvokeRequest struct {
	Agent  string         `json:"agent"`
	Input  map[string]any `json:"input"`
	Model  string         `json:"model,omitempty"`
}

type InvokeResponse struct {
	Agent  string         `json:"agent"`
	Output map[string]any `json:"output"`
	Model  string         `json:"model"`
}

func (c *Client) Invoke(ctx context.Context, agent string, input map[string]any) (map[string]any, error) {
	body, err := json.Marshal(InvokeRequest{
		Agent: agent,
		Input: input,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal invoke request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/llm/invoke", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create invoke request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("llm invoke request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read invoke response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("llm invoke status %d: %s", resp.StatusCode, string(respBody))
	}

	var payload InvokeResponse
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return nil, fmt.Errorf("decode invoke response: %w", err)
	}

	return payload.Output, nil
}

func (c *Client) WithTimeout(timeout time.Duration) *Client {
	copyClient := *c
	copyClient.httpClient = &http.Client{Timeout: timeout}
	return &copyClient
}
