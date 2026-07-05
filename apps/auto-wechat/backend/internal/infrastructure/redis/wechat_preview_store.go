package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

var ErrPreviewNotFound = errors.New("wechat preview not found")

const wechatPreviewKeyPrefix = "wechat:preview:"

type WeChatPreviewPayload struct {
	Title    string `json:"title"`
	BodyHTML string `json:"bodyHtml"`
}

type WeChatPreviewStore struct {
	client *goredis.Client
	ttl    time.Duration
}

func NewWeChatPreviewStore(client *goredis.Client, ttl time.Duration) *WeChatPreviewStore {
	return &WeChatPreviewStore{client: client, ttl: ttl}
}

func (s *WeChatPreviewStore) TTL() time.Duration {
	return s.ttl
}

func (s *WeChatPreviewStore) Save(ctx context.Context, token string, payload WeChatPreviewPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal preview payload: %w", err)
	}
	if err := s.client.Set(ctx, wechatPreviewKeyPrefix+token, data, s.ttl).Err(); err != nil {
		return fmt.Errorf("save preview token: %w", err)
	}
	return nil
}

func (s *WeChatPreviewStore) Get(ctx context.Context, token string) (WeChatPreviewPayload, error) {
	data, err := s.client.Get(ctx, wechatPreviewKeyPrefix+token).Bytes()
	if err == goredis.Nil {
		return WeChatPreviewPayload{}, ErrPreviewNotFound
	}
	if err != nil {
		return WeChatPreviewPayload{}, fmt.Errorf("get preview token: %w", err)
	}
	var payload WeChatPreviewPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return WeChatPreviewPayload{}, fmt.Errorf("decode preview payload: %w", err)
	}
	return payload, nil
}
