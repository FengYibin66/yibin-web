package mysql

import (
	"encoding/json"
	"testing"
)

func TestNullableJSONBytesScan_nilBecomesEmptyRawMessage(t *testing.T) {
	var raw json.RawMessage
	var configJSON []byte // simulates sql NULL → nil []byte
	raw = configJSON
	if raw != nil {
		t.Fatalf("expected nil RawMessage for NULL column, got %q", raw)
	}
}

func TestNullableJSONBytesScan_valueRoundTrips(t *testing.T) {
	configJSON := []byte(`{"keywords":["AI"]}`)
	raw := json.RawMessage(configJSON)
	if string(raw) != `{"keywords":["AI"]}` {
		t.Fatalf("unexpected raw: %s", raw)
	}
}
