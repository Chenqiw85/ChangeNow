package handlers

import "github.com/jackc/pgx/v5/pgxpool"

type Handlers struct {
  db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Handlers {
  return &Handlers{db: db}
}