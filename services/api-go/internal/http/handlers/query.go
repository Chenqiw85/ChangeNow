package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handlers) GetTask(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	var status string
	var planID *uuid.UUID
	var errMsg *string

	err = h.db.QueryRow(c.Request.Context(),
		`select status, plan_id, error_message from tasks where id=$1`, id,
	).Scan(&status, &planID, &errMsg)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	resp := gin.H{"id": id.String(), "status": status}
	if planID != nil {
		resp["plan_id"] = planID.String()
	}
	if errMsg != nil {
		resp["error_message"] = *errMsg
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handlers) GetPlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plan id"})
		return
	}

	var text string
	err = h.db.QueryRow(c.Request.Context(),
		`select plan_text from plans where id=$1`, id,
	).Scan(&text)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": id.String(), "plan_text": text})
}
