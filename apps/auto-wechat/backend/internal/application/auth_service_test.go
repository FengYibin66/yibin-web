package application

import (
	"context"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

type memorySessionStore struct {
	sessions map[string]domain.Session
}

func (m *memorySessionStore) Create(_ context.Context, username string) (string, domain.Session, error) {
	if m.sessions == nil {
		m.sessions = make(map[string]domain.Session)
	}
	now := time.Now().UTC()
	session := domain.Session{
		UserID:    username,
		Username:  username,
		Role:      domain.AdminRole,
		CreatedAt: now,
		ExpiresAt: now.Add(time.Hour),
	}
	sessionID := "test-session-id"
	m.sessions[sessionID] = session
	return sessionID, session, nil
}

func (m *memorySessionStore) Get(_ context.Context, sessionID string) (domain.Session, error) {
	session, ok := m.sessions[sessionID]
	if !ok {
		return domain.Session{}, ErrInvalidCredentials
	}
	return session, nil
}

func (m *memorySessionStore) Delete(_ context.Context, sessionID string) error {
	delete(m.sessions, sessionID)
	return nil
}

type memoryAdminUserRepo struct {
	users map[string]domain.AdminUser
}

func (m *memoryAdminUserRepo) Count(_ context.Context) (int, error) {
	return len(m.users), nil
}

func (m *memoryAdminUserRepo) GetByUsername(_ context.Context, username string) (domain.AdminUser, error) {
	user, ok := m.users[username]
	if !ok {
		return domain.AdminUser{}, mysql.ErrNotFound
	}
	return user, nil
}

func (m *memoryAdminUserRepo) Create(_ context.Context, username, passwordHash, role string) (domain.AdminUser, error) {
	if m.users == nil {
		m.users = make(map[string]domain.AdminUser)
	}
	user := domain.AdminUser{
		ID:           "user-1",
		Username:     username,
		PasswordHash: passwordHash,
		Role:         role,
	}
	m.users[username] = user
	return user, nil
}

func TestAuthServiceLoginAndSession(t *testing.T) {
	t.Parallel()

	hash, err := bcrypt.GenerateFromPassword([]byte("secret-pass"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	userRepo := &memoryAdminUserRepo{
		users: map[string]domain.AdminUser{
			"admin": {
				ID:           "user-1",
				Username:     "admin",
				PasswordHash: string(hash),
				Role:         domain.AdminRole,
			},
		},
	}
	service := NewAuthService(userRepo, &memorySessionStore{})

	sessionID, session, err := service.Login(context.Background(), "admin", "secret-pass")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if sessionID == "" || session.Username != "admin" {
		t.Fatalf("unexpected session: %#v", session)
	}

	got, err := service.GetSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.Username != "admin" {
		t.Fatalf("expected admin, got %s", got.Username)
	}
}

func TestAuthServiceInvalidPassword(t *testing.T) {
	t.Parallel()

	hash, err := bcrypt.GenerateFromPassword([]byte("secret-pass"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	userRepo := &memoryAdminUserRepo{
		users: map[string]domain.AdminUser{
			"admin": {
				Username:     "admin",
				PasswordHash: string(hash),
				Role:         domain.AdminRole,
			},
		},
	}
	service := NewAuthService(userRepo, &memorySessionStore{})

	_, _, err = service.Login(context.Background(), "admin", "wrong-pass")
	if err == nil || err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}
