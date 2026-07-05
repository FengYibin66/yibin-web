package middleware

import "github.com/gin-gonic/gin"

const (
	contextAuthUser   = "auth_user"
	contextAuthRole   = "auth_role"
	contextAuthMethod = "auth_method"
)

func AuthUser(c *gin.Context) (string, bool) {
	value, ok := c.Get(contextAuthUser)
	if !ok {
		return "", false
	}
	username, ok := value.(string)
	return username, ok && username != ""
}

func AuthRole(c *gin.Context) string {
	value, ok := c.Get(contextAuthRole)
	if !ok {
		return ""
	}
	role, _ := value.(string)
	return role
}

func setAuthContext(c *gin.Context, username, role, method string) {
	c.Set(contextAuthUser, username)
	c.Set(contextAuthRole, role)
	c.Set(contextAuthMethod, method)
}
