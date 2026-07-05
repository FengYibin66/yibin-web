package mysql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type AdminUserRepository struct {
	db *sql.DB
}

func NewAdminUserRepository(db *sql.DB) *AdminUserRepository {
	return &AdminUserRepository{db: db}
}

func (r *AdminUserRepository) Count(ctx context.Context) (int, error) {
	const query = `SELECT COUNT(*) FROM admin_users`
	var count int
	if err := r.db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("count admin users: %w", err)
	}
	return count, nil
}

func (r *AdminUserRepository) GetByUsername(ctx context.Context, username string) (domain.AdminUser, error) {
	const query = `
		SELECT id, username, password_hash, role, created_at
		FROM admin_users
		WHERE username = ?
	`
	var user domain.AdminUser
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.AdminUser{}, ErrNotFound
		}
		return domain.AdminUser{}, fmt.Errorf("get admin user: %w", err)
	}
	return user, nil
}

func (r *AdminUserRepository) Create(ctx context.Context, username, passwordHash, role string) (domain.AdminUser, error) {
	if role == "" {
		role = domain.AdminRole
	}

	id := uuid.NewString()
	const query = `
		INSERT INTO admin_users (id, username, password_hash, role)
		VALUES (?, ?, ?, ?)
	`
	if _, err := r.db.ExecContext(ctx, query, id, username, passwordHash, role); err != nil {
		return domain.AdminUser{}, fmt.Errorf("insert admin user: %w", err)
	}
	return r.GetByUsername(ctx, username)
}
