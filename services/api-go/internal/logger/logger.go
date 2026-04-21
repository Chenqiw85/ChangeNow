package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Global logger instance
var Log *zap.Logger

// Init sets up the global structured logger.
// In production, outputs JSON. In development, outputs human-readable format.
func Init() {
	env := os.Getenv("APP_ENV")

	var config zap.Config
	if env == "production" {
		config = zap.NewProductionConfig()
	} else {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	config.EncoderConfig.TimeKey = "time"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	var err error
	Log, err = config.Build()
	if err != nil {
		panic("failed to initialize logger: " + err.Error())
	}
}

// Sync flushes any buffered log entries. Call before app exits.
func Sync() {
	_ = Log.Sync()
}
