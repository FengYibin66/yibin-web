package application

import (
	"context"
	"fmt"
	"log"
)

func WarnIfNoAdminUsers(ctx context.Context, repo AdminUserRepository) error {
	count, err := repo.Count(ctx)
	if err != nil {
		return fmt.Errorf("count admin users: %w", err)
	}
	if count == 0 {
		log.Printf("warning: admin_users is empty; run createadmin to create the first admin before browser login works")
	}
	return nil
}
