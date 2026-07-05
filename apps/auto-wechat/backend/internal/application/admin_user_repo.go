package application

import (
	"context"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type AdminUserRepository interface {
	Count(ctx context.Context) (int, error)
	GetByUsername(ctx context.Context, username string) (domain.AdminUser, error)
	Create(ctx context.Context, username, passwordHash, role string) (domain.AdminUser, error)
}
