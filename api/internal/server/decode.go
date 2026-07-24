package server

import (
	"encoding/json"
	"net/http"
)

// decodeJSON decodes the request body into v, writing a 400 on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}
