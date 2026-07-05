package redis

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

const sessionKeyPrefix = "session:"

type SessionStore struct {
	client *goredis.Client
	ttl    time.Duration
}

func NewSessionStore(client *goredis.Client, ttl time.Duration) *SessionStore {
	return &SessionStore{client: client, ttl: ttl}
}

func (s *SessionStore) Create(ctx context.Context, username string) (string, domain.Session, error) {
	sessionID, err := newSessionID()
	if err != nil {
		return "", domain.Session{}, err
	}

	now := time.Now().UTC()
	session := domain.Session{
		UserID:    username,
		Username:  username,
		Role:      domain.AdminRole,
		CreatedAt: now,
		ExpiresAt: now.Add(s.ttl),
	}

	payload, err := json.Marshal(session)
	if err != nil {
		return "", domain.Session{}, fmt.Errorf("marshal session: %w", err)
	}

	key := sessionKeyPrefix + sessionID
	if err := s.client.Set(ctx, key, payload, s.ttl).Err(); err != nil {
		return "", domain.Session{}, fmt.Errorf("set session: %w", err)
	}

	return sessionID, session, nil
}

func (s *SessionStore) Get(ctx context.Context, sessionID string) (domain.Session, error) {
	if sessionID == "" {
		return domain.Session{}, ErrSessionNotFound
	}

	payload, err := s.client.Get(ctx, sessionKeyPrefix+sessionID).Bytes()
	if err != nil {
		if err == goredis.Nil {
			return domain.Session{}, ErrSessionNotFound
		}
		return domain.Session{}, fmt.Errorf("get session: %w", err)
	}

	var session domain.Session
	if err := json.Unmarshal(payload, &session); err != nil {
		return domain.Session{}, fmt.Errorf("unmarshal session: %w", err)
	}

	return session, nil
}

func (s *SessionStore) Delete(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	return s.client.Del(ctx, sessionKeyPrefix+sessionID).Err()
}

func newSessionID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate session id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
