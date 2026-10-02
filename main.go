package main

import (
	"log"
	"log/syslog"
	"main/models"
	"os"
	"sync"
	"time"

	"github.com/oschwald/geoip2-golang"
	llama "github.com/unidiag/go-llama"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const VERSION = "1.02"
const BUILD_DATE = "2026-10-02"
const BUILD_TIME = "22:22:48"

type LiveViewer struct {
	FirstSeen time.Time
	LastSeen  time.Time
	UserAgent string
}

var (
	mu        sync.Mutex
	debug     = false
	err       error
	settings  map[string]string
	db        *gorm.DB
	sysLogger *syslog.Writer
	runtime   time.Time
	dbip      *geoip2.Reader

	llamaClient *llama.Client

	liveViewersMu sync.Mutex
	liveViewers   = make(map[string]LiveViewer)
)

func main() {
	runtime = time.Now()

	// config.example.ini er
	if err := loadConfig("config.ini"); err != nil {
		log.Fatal(err)
	}

	sysLogger, err = syslog.New(
		syslog.LOG_INFO|syslog.LOG_DAEMON,
		config.App.Name,
	)
	if err != nil {
		log.Println("syslog init error:", err)
	}

	debug = isRunThroughGoRun()
	slog("Server run in DEBUG-mode", "debug")

	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			IgnoreRecordNotFoundError: true,
			ParameterizedQueries:      true,
			Colorful:                  false,
			LogLevel: func() logger.LogLevel {
				if debug {
					return logger.Warn
				}

				return logger.Error
			}(),
		},
	)

	db, err = gorm.Open(
		mysql.Open(config.Database.DSN),
		&gorm.Config{
			Logger: gormLogger,
		},
	)

	if err != nil {
		log.Fatal("DB open error:", err)
	}

	if err = db.AutoMigrate(models.AllModels...); err != nil {
		slog("DB migrate error: "+err.Error(), "error")
		log.Fatal(err)
	}

	initGeoIP()

	go meteoWorker()
	go webserver()

	for {
		delay(1000)
	}
}
