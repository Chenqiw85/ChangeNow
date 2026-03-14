package handlers

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type registerReq struct {
  Email    string `json:"email" binding:"required,email"`
  Password string `json:"password" binding:"required,min=6"`
}

func (h *Handlers) Register(c *gin.Context) {
  var req registerReq
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

  var id int64
  err := h.db.QueryRow(context.Background(),
    `insert into users(email, password_hash) values ($1,$2) returning id`,
    req.Email, string(hash),
  ).Scan(&id)

  if err != nil {
    log.Printf("DEBUG: Database insert failed: %v", err)
    c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists or db error"})
    return
  }

  c.JSON(http.StatusCreated, gin.H{"id": id, "email": req.Email})
}

type loginReq struct {
  Email    string `json:"email" binding:"required,email"`
  Password string `json:"password" binding:"required"`
}

func (h *Handlers) Login(c *gin.Context) {
  var req loginReq
  if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
  }

  var id int64
  var hash string
  err := h.db.QueryRow(context.Background(),
    `select id, password_hash from users where email=$1`,
    req.Email,
  ).Scan(&id, &hash)
  if err != nil {
    c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
    return
  }

  if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
    c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
    return
  }

  secret := os.Getenv("JWT_SECRET")
  claims := jwt.MapClaims{
    "user_id": id,
    "exp":     time.Now().Add(24 * time.Hour).Unix(),
  }
  token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
  signed, _ := token.SignedString([]byte(secret))

  c.JSON(http.StatusOK, gin.H{"access_token": signed})
}