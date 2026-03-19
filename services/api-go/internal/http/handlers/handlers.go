package handlers

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"changenow/api-go/internal/ai"
)

type Handlers struct {
  db *pgxpool.Pool
  aiClient *ai.Client 
}

func New(db *pgxpool.Pool, aiClient *ai.Client) *Handlers {
  return &Handlers{db: db, aiClient: aiClient}
}