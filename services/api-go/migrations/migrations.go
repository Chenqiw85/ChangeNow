// Package migrations exposes the SQL migration files as an embed.FS so they
// can be applied at application startup without relying on the Postgres
// docker-entrypoint-initdb.d path (which only runs on a fresh volume).
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
