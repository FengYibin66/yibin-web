package application

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"

	"github.com/auto-wechat-tech/backend/internal/domain"
	redisinfra "github.com/auto-wechat-tech/backend/internal/infrastructure/redis"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAuthNotConfigured  = errors.New("admin auth is not configured")
)

type SessionRepository interface {
	Create(ctx context.Context, username string) (string, domain.Session, error)
	Get(ctx context.Context, sessionID string) (domain.Session, error)
	Delete(ctx context.Context, sessionID string) error
}

type AuthService struct {
	users    AdminUserRepository
	sessions SessionRepository
}

func NewAuthService(users AdminUserRepository, sessions SessionRepository) *AuthService {
	return &AuthService{
		users:    users,
		sessions: sessions,
	}
}

func (s *AuthService) SessionLoginEnabled(ctx context.Context) bool {
	count, err := s.users.Count(ctx)
	return err == nil && count > 0
}

func (s *AuthService) Login(ctx context.Context, username, password string) (string, domain.Session, error) {
	if !s.SessionLoginEnabled(ctx) {
		return "", domain.Session{}, ErrAuthNotConfigured
	}

	user, err := s.users.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			return "", domain.Session{}, ErrInvalidCredentials
		}
		return "", domain.Session{}, fmt.Errorf("get admin user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", domain.Session{}, ErrInvalidCredentials
	}

	sessionID, session, err := s.sessions.Create(ctx, user.Username)
	if err != nil {
		return "", domain.Session{}, fmt.Errorf("create session: %w", err)
	}

	return sessionID, session, nil
}

func (s *AuthService) Logout(ctx context.Context, sessionID string) error {
	return s.sessions.Delete(ctx, sessionID)
}

func (s *AuthService) GetSession(ctx context.Context, sessionID string) (domain.Session, error) {
	session, err := s.sessions.Get(ctx, sessionID)
	if err != nil {
		if errors.Is(err, redisinfra.ErrSessionNotFound) {
			return domain.Session{}, ErrInvalidCredentials
		}
		return domain.Session{}, err
	}
	return session, nil
}
