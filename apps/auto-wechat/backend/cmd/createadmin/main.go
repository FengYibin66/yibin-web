package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"

	"github.com/auto-wechat-tech/backend/internal/config"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

func main() {
	username := flag.String("username", "admin", "admin username")
	password := flag.String("password", "", "admin password (required)")
	flag.Parse()

	if *password == "" {
		fmt.Fprintln(os.Stderr, "usage: createadmin -username admin -password 'your-strong-password'")
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := cfg.Validate(); err != nil {
		log.Fatalf("invalid config: %v", err)
	}

	ctx := context.Background()
	db, err := mysql.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect mysql: %v", err)
	}
	defer db.Close()

	repo := mysql.NewAdminUserRepository(db)
	count, err := repo.Count(ctx)
	if err != nil {
		log.Fatalf("count admin users: %v", err)
	}
	if count > 0 {
		log.Fatalf("admin_users already has %d user(s); refusing to create another via CLI", count)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}

	user, err := repo.Create(ctx, *username, string(hash), domain.AdminRole)
	if err != nil {
		log.Fatalf("create admin user: %v", err)
	}

	log.Printf("created admin user: %s (id=%s)", user.Username, user.ID)
}
