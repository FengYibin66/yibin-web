package dto

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthUserResponse struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}
