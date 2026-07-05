package mysql

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var ErrNotFound = fmt.Errorf("not found")

// pipelineStepOrder is the canonical step sequence; keep in sync with domain.DefaultPipelineSteps.
const pipelineStepOrder = "'collect','rank','enrich','editor','writer','illustrate','layout','review','cover','publish'"

// pipelineStepField orders pipeline steps for comparisons and ORDER BY.
const pipelineStepField = "FIELD(step, " + pipelineStepOrder + ")"

const pipelineStepFieldParam = "FIELD(?, " + pipelineStepOrder + ")"

func nullString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func nullUUID(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func errorsIsNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

// NormalizeDSN strips the mysql:// scheme for database/sql.
func NormalizeDSN(databaseURL string) (string, error) {
	dsn := strings.TrimSpace(databaseURL)
	if dsn == "" {
		return "", fmt.Errorf("empty database url")
	}
	if strings.HasPrefix(dsn, "mysql://") {
		dsn = strings.TrimPrefix(dsn, "mysql://")
	}
	return ensureDSNCharset(dsn), nil
}

func ensureDSNCharset(dsn string) string {
	if strings.Contains(strings.ToLower(dsn), "charset=") {
		return dsn
	}
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return dsn + sep + "charset=utf8mb4"
}

// MigrateURL returns a golang-migrate compatible MySQL URL.
func MigrateURL(databaseURL string) (string, error) {
	dsn, err := NormalizeDSN(databaseURL)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(databaseURL, "mysql://") {
		if strings.Contains(dsn, "multiStatements=true") {
			return databaseURL, nil
		}
		sep := "?"
		if strings.Contains(dsn, "?") {
			sep = "&"
		}
		return databaseURL + sep + "multiStatements=true", nil
	}
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	return "mysql://" + dsn + sep + "multiStatements=true", nil
}
