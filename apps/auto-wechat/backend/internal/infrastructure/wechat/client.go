package wechat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

const tokenRedisKey = "wechat:access_token"

type Config struct {
	AppID     string
	AppSecret string
}

type Client struct {
	cfg        Config
	redis      *goredis.Client
	httpClient *http.Client
}

func NewClient(cfg Config, redis *goredis.Client) *Client {
	return &Client{
		cfg:   cfg,
		redis: redis,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (c *Client) Enabled() bool {
	return c.cfg.AppID != "" && c.cfg.AppSecret != ""
}

func (c *Client) AccessToken(ctx context.Context) (string, error) {
	if c.redis != nil {
		token, err := c.redis.Get(ctx, tokenRedisKey).Result()
		if err == nil && token != "" {
			return token, nil
		}
	}

	token, expiresIn, err := c.fetchStableToken(ctx)
	if err != nil {
		return "", err
	}

	if c.redis != nil && expiresIn > 300 {
		ttl := time.Duration(expiresIn-300) * time.Second
		_ = c.redis.Set(ctx, tokenRedisKey, token, ttl).Err()
	}

	return token, nil
}

func (c *Client) fetchStableToken(ctx context.Context) (string, int, error) {
	body, err := json.Marshal(map[string]any{
		"grant_type":    "client_credential",
		"appid":         c.cfg.AppID,
		"secret":        c.cfg.AppSecret,
		"force_refresh": false,
	})
	if err != nil {
		return "", 0, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.weixin.qq.com/cgi-bin/stable_token", bytes.NewReader(body))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("stable_token request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, err
	}

	var payload struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", 0, fmt.Errorf("decode stable_token: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", 0, fmt.Errorf("stable_token errcode %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.AccessToken == "" {
		return "", 0, fmt.Errorf("stable_token empty access_token")
	}

	return payload.AccessToken, payload.ExpiresIn, nil
}

func (c *Client) UploadThumb(ctx context.Context, filename string, imageData []byte) (string, error) {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return "", err
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("media", filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(imageData); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=thumb", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("upload thumb: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var payload struct {
		MediaID string `json:"media_id"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", fmt.Errorf("decode upload thumb: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", fmt.Errorf("upload thumb errcode %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.MediaID == "" {
		return "", fmt.Errorf("upload thumb empty media_id")
	}

	return payload.MediaID, nil
}

func (c *Client) UploadContentImage(ctx context.Context, filename string, imageData []byte) (string, error) {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return "", err
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("media", filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(imageData); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=%s", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("uploadimg: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var payload struct {
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", fmt.Errorf("decode uploadimg: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", fmt.Errorf("uploadimg errcode %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.URL == "" {
		return "", fmt.Errorf("uploadimg empty url")
	}
	return payload.URL, nil
}

type DraftArticle struct {
	Title            string
	Author           string
	Digest           string
	Content          string
	ThumbMediaID     string
	ContentSourceURL string
}

func (c *Client) AddDraft(ctx context.Context, article DraftArticle) (string, error) {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return "", err
	}

	body, err := json.Marshal(map[string]any{
		"articles": []map[string]any{
			{
				"title":              article.Title,
				"author":             article.Author,
				"digest":             article.Digest,
				"content":            article.Content,
				"thumb_media_id":     article.ThumbMediaID,
				"content_source_url": article.ContentSourceURL,
				"need_open_comment":  0,
				"only_fans_can_comment": 0,
			},
		},
	})
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/draft/add?access_token=%s", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("draft/add: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var payload struct {
		MediaID string `json:"media_id"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", fmt.Errorf("decode draft/add: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", fmt.Errorf("draft/add errcode %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.MediaID == "" {
		return "", fmt.Errorf("draft/add empty media_id")
	}

	return payload.MediaID, nil
}
