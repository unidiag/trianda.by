package main

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"gopkg.in/ini.v1"
)

type AppConfig struct {
	App struct {
		Name    string
		Link    string
		WWWPort string
		Sender  string
		Meteo   string
	}

	Database struct {
		DSN string
	}

	Auth struct {
		JWTSecret  []byte
		AccessTTL  time.Duration
		RefreshTTL time.Duration
	}

	Cams struct {
		Dir   string
		Depth int
	}

	ERIP struct {
		FTP  string
		User string
		Pass string
	}
}

var config AppConfig

func loadConfig(filename string) error {
	if _, err := os.Stat(filename); err != nil {
		return fmt.Errorf("config file %q: %w", filename, err)
	}

	cfg, err := ini.LoadSources(
		ini.LoadOptions{
			IgnoreInlineComment: true,
		},
		filename,
	)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// APP
	config.App.Name = cfg.Section("app").Key("name").MustString("TRIANDA.BY")
	config.App.Link = cfg.Section("app").Key("link").MustString("https://trianda.by")
	config.App.WWWPort = cfg.Section("app").Key("wwwport").MustString("127.0.0.1:8888")
	config.App.Sender = cfg.Section("app").Key("sender").String()
	config.App.Meteo = cfg.Section("app").Key("meteo").String()

	// DATABASE
	config.Database.DSN = cfg.Section("database").Key("dsn").String()
	if config.Database.DSN == "" {
		return fmt.Errorf("database.dsn is empty")
	}

	// AUTH
	jwtSecret := cfg.Section("auth").Key("jwt_secret").String()
	if jwtSecret == "" {
		return fmt.Errorf("auth.jwt_secret is empty")
	}

	config.Auth.JWTSecret = []byte(jwtSecret)

	accessMinutes := cfg.Section("auth").
		Key("access_ttl_minutes").
		MustInt(10)

	refreshHours := cfg.Section("auth").
		Key("refresh_ttl_hours").
		MustInt(14 * 24)

	config.Auth.AccessTTL =
		time.Duration(accessMinutes) * time.Minute

	config.Auth.RefreshTTL =
		time.Duration(refreshHours) * time.Hour

	// CAMS
	config.Cams.Dir = cfg.
		Section("cams").
		Key("dir").
		MustString("/mnt/cameras")

	config.Cams.Depth = cfg.
		Section("cams").
		Key("depth").
		MustInt(168)

		// ERIP
	config.ERIP.FTP = cfg.
		Section("erip").
		Key("ftp").
		String()

	config.ERIP.User = cfg.
		Section("erip").
		Key("user").
		String()

	config.ERIP.Pass = cfg.
		Section("erip").
		Key("pass").
		String()

	if config.ERIP.FTP == "" {
		return fmt.Errorf("erip.ftp is empty")
	}

	if config.ERIP.User == "" {
		return fmt.Errorf("erip.user is empty")
	}

	if config.ERIP.Pass == "" {
		return fmt.Errorf("erip.pass is empty")
	}

	return nil
}

func configInt(section, key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}

	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultValue
	}

	return n
}
