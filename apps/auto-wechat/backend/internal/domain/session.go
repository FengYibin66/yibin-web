package domain

import "time"

const AdminRole = "admin"

type Session struct {
	UserID    string
	Username  string
	Role      string
	CreatedAt time.Time
	ExpiresAt time.Time
}
