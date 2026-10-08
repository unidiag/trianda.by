package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"main/models"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jlaffaye/ftp"
)

const (
	eripRemoteDir = "out"
	eripLocalDir  = "./erip"
	eripInterval  = 5 * time.Minute
)

func eripWorker() {
	// Первый запуск сразу после старта сервера.
	eripSync()

	ticker := time.NewTicker(eripInterval)
	defer ticker.Stop()

	for range ticker.C {
		eripSync()
	}
}

func eripSync() {
	if err := downloadERIPFiles(); err != nil {
		slog("ERIP: "+err.Error(), "error")
	}

	// FTP-сессия к этому моменту уже закрыта.
	// Импортируем все локальные файлы,
	// включая оставшиеся от предыдущих запусков.
	importERIPPayments()

	// удаляем файлы старше 7 суток
	cleanupERIPFiles()
}

func downloadERIPFiles() (syncErr error) {
	syncLog := models.EripSyncLog{
		CreatedAt: time.Now(),
	}

	var fileErrors []string

	defer func() {
		if syncErr != nil {
			fileErrors = append(fileErrors, syncErr.Error())
		}

		syncLog.Error = strings.Join(fileErrors, "\n")

		if err := db.Create(&syncLog).Error; err != nil {
			slog(
				"ERIP: save sync log error: "+err.Error(),
				"error",
			)
		}
	}()

	u, err := url.Parse(config.ERIP.FTP)
	if err != nil {
		return fmt.Errorf("parse FTP URL: %w", err)
	}

	if u.Scheme != "ftps" {
		return fmt.Errorf(
			"unsupported FTP scheme %q, expected ftps",
			u.Scheme,
		)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("FTP host is empty")
	}

	port := u.Port()
	if port == "" {
		port = "990"
	}

	addr := net.JoinHostPort(host, port)

	tlsConfig := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}

	slog("ERIP: connecting to "+addr, "info")

	// slog(
	// 	fmt.Sprintf(
	// 		"ERIP: user=%q passLen=%d ftp=%q",
	// 		config.ERIP.User,
	// 		len(config.ERIP.Pass),
	// 		config.ERIP.FTP,
	// 	),
	// 	"info",
	// )

	conn, err := ftp.Dial(
		addr,
		ftp.DialWithTimeout(30*time.Second),
		ftp.DialWithExplicitTLS(tlsConfig),

		// Принудительно используем LIST вместо MLSD
		ftp.DialWithDisabledMLSD(true),
	)
	if err != nil {
		return fmt.Errorf("connect %s: %w", addr, err)
	}

	defer func() {
		if err := conn.Quit(); err != nil {
			msg := "ERIP: FTP quit error: " + err.Error()
			slog(msg, "error")
			fileErrors = append(fileErrors, msg)
		}
	}()

	if err := conn.Login(
		config.ERIP.User,
		config.ERIP.Pass,
	); err != nil {
		return fmt.Errorf("login: %w", err)
	}

	syncLog.Connected = true
	slog("ERIP: connected", "info")

	if err := conn.ChangeDir(eripRemoteDir); err != nil {
		return fmt.Errorf(
			"change directory %q: %w",
			eripRemoteDir,
			err,
		)
	}

	// Проверяем текущую директорию FTP
	entries, err := conn.List(".")
	if err != nil {
		return fmt.Errorf("list %q: %w", eripRemoteDir, err)
	}

	if err := os.MkdirAll(eripLocalDir, 0755); err != nil {
		return fmt.Errorf(
			"create local directory %q: %w",
			eripLocalDir,
			err,
		)
	}

	for _, entry := range entries {
		if entry.Type != ftp.EntryTypeFile {
			continue
		}

		if !strings.EqualFold(
			filepath.Ext(entry.Name),
			".206",
		) {
			continue
		}

		syncLog.Found++

		if err := moveERIPFile(conn, entry.Name); err != nil {
			msg := fmt.Sprintf(
				"ERIP: file %q error: %v",
				entry.Name,
				err,
			)

			slog(msg, "error")
			fileErrors = append(fileErrors, msg)
			continue
		}

		syncLog.Moved++
	}

	slog(
		fmt.Sprintf(
			"ERIP: sync complete, found=%d moved=%d",
			syncLog.Found,
			syncLog.Moved,
		),
		"info",
	)

	return nil
}

func moveERIPFile(
	conn *ftp.ServerConn,
	filename string,
) error {
	// filepath.Base защищает от неожиданного имени вроде
	// ../../something со стороны FTP.
	filename = filepath.Base(filename)

	if filename == "." ||
		filename == string(filepath.Separator) ||
		filename == "" {
		return fmt.Errorf("invalid filename")
	}

	localPath := filepath.Join(
		eripLocalDir,
		filename,
	)

	/*
		Сначала скачиваем во временный файл.

		Никогда не пишем сразу в конечный .206:
		при обрыве FTP иначе в ./erip останется
		частично загруженный файл.
	*/
	tmp, err := os.CreateTemp(
		eripLocalDir,
		".erip-*.tmp",
	)
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}

	tmpName := tmp.Name()

	success := false

	defer func() {
		tmp.Close()

		if !success {
			_ = os.Remove(tmpName)
		}
	}()

	resp, err := conn.Retr(filename)
	if err != nil {
		return fmt.Errorf("download: %w", err)
	}

	_, copyErr := io.Copy(tmp, resp)
	closeRespErr := resp.Close()

	if copyErr != nil {
		return fmt.Errorf("write local file: %w", copyErr)
	}

	if closeRespErr != nil {
		return fmt.Errorf(
			"close FTP transfer: %w",
			closeRespErr,
		)
	}

	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("sync local file: %w", err)
	}

	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close local file: %w", err)
	}

	/*
		os.Rename под Linux атомарный.

		Если в ./erip уже существует файл с таким именем,
		он будет заменён только полностью скачанной копией.
	*/
	if err := os.Rename(tmpName, localPath); err != nil {
		return fmt.Errorf(
			"rename %q -> %q: %w",
			tmpName,
			localPath,
			err,
		)
	}

	success = true

	/*
		Удаляем удалённый файл ТОЛЬКО после того,
		как локальная копия полностью записана.

		Именно это превращает операцию из просто
		"скачать" в "перенести".
	*/
	if err := conn.Delete(filename); err != nil {
		return fmt.Errorf(
			"local file saved, but remote delete failed: %w",
			err,
		)
	}

	slog(
		fmt.Sprintf(
			"ERIP: moved %q -> %q",
			filename,
			localPath,
		),
		"info",
	)

	return nil
}

func cleanupERIPFiles() {
	entries, err := os.ReadDir(eripLocalDir)
	if err != nil {
		slog("ERIP: cleanup readdir: "+err.Error(), "error")
		return
	}

	cutoff := time.Now().Add(-24 * time.Hour)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		if !strings.EqualFold(filepath.Ext(entry.Name()), ".206") {
			continue
		}

		path := filepath.Join(eripLocalDir, entry.Name())

		info, err := entry.Info()
		if err != nil {
			slog(
				fmt.Sprintf(
					"ERIP: cleanup stat %q: %v",
					path,
					err,
				),
				"error",
			)
			continue
		}

		if info.ModTime().After(cutoff) {
			continue
		}

		if err := os.Remove(path); err != nil {
			slog(
				fmt.Sprintf(
					"ERIP: cleanup remove %q: %v",
					path,
					err,
				),
				"error",
			)
			continue
		}

		slog(
			fmt.Sprintf(
				"ERIP: deleted old file %q",
				path,
			),
			"info",
		)
	}
}
