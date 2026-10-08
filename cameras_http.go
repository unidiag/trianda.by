package main

import (
	"fmt"
	"io"
	"main/models"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	cameraPlayLockDuration    = 10 * time.Minute
	CameraArchiveTypeDownload = "download"
	CameraArchiveTypePlay     = "play"
	cameraPlayLuaPath         = "/usr/src/cameras/play.lua"
)

var cameraPlayState = struct {
	sync.Mutex

	Personal string
	Surname  string

	Until time.Time
}{}

func saveCameraArchiveLog(
	camera string,
	archiveUnix int64,
	personal string,
	surname string,
	ip string,
	userAgent string,
	actionType string,
) {
	logRow := models.CameraArchiveLog{
		Camera: camera,

		ArchiveTime: time.Unix(
			archiveUnix,
			0,
		).In(time.Local),

		Personal: strings.TrimSpace(
			personal,
		),

		Surname: strings.TrimSpace(
			surname,
		),

		IP: strings.TrimSpace(
			ip,
		),

		UserAgent: strings.TrimSpace(
			userAgent,
		),

		Type: actionType,
	}

	if err := db.Create(
		&logRow,
	).Error; err != nil {

		slog(
			"camera archive log error: "+
				err.Error(),
			"error",
		)

		return
	}

	/*
		Удаляем записи старше 1 года.
	*/

	cutoff := time.Now().AddDate(
		-1,
		0,
		0,
	)

	if err := db.
		Where(
			"created_at < ?",
			cutoff,
		).
		Delete(
			&models.CameraArchiveLog{},
		).Error; err != nil {

		slog(
			"camera archive cleanup error: "+
				err.Error(),
			"error",
		)
	}
}

func cameraPreviewHandler(
	w http.ResponseWriter,
	r *http.Request,
) {

	if r.Method != http.MethodGet {
		http.Error(
			w,
			"Method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	cam := strings.TrimSpace(
		r.URL.Query().Get("cam"),
	)

	if !isPublicCamera(cam) {
		http.Error(
			w,
			"Invalid camera",
			http.StatusBadRequest,
		)
		return
	}

	unix, err := strconv.ParseInt(
		r.URL.Query().Get("t"),
		10,
		64,
	)

	if err != nil || unix <= 0 {
		http.Error(
			w,
			"Invalid time",
			http.StatusBadRequest,
		)
		return
	}

	path := filepath.Join(
		config.Cams.Dir,
		cam,
		fmt.Sprintf(
			"%d.jpg",
			unix,
		),
	)

	info, err := os.Stat(path)

	if err != nil ||
		info.IsDir() ||
		info.Size() == 0 {

		http.NotFound(
			w,
			r,
		)

		return
	}

	w.Header().Set(
		"Cache-Control",
		"public, max-age=86400",
	)

	w.Header().Set(
		"Content-Type",
		"image/jpeg",
	)

	http.ServeFile(
		w,
		r,
		path,
	)
}

func cameraDownloadHandler(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"Method not allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	/*
		Проверяем права абонента
		непосредственно перед скачиванием.
	*/

	personal := strings.TrimSpace(
		r.URL.Query().Get("personal"),
	)

	surname := strings.TrimSpace(
		r.URL.Query().Get("surname"),
	)

	if personal == "" ||
		surname == "" {

		http.Error(
			w,
			"Subscriber data required",
			http.StatusUnauthorized,
		)

		return
	}

	subscriber, err :=
		checkSubscriber(
			personal,
			surname,
		)

	if err != nil {
		slog(
			"camera download subscriber check: "+
				err.Error(),
			"error",
		)

		http.Error(
			w,
			"Subscriber check failed",
			http.StatusInternalServerError,
		)

		return
	}

	if !subscriber.Found {
		http.Error(
			w,
			"Subscriber not found",
			http.StatusForbidden,
		)

		return
	}

	if !strings.EqualFold(
		strings.TrimSpace(
			subscriber.Tarif,
		),
		"Цифровой пакет",
	) {
		http.Error(
			w,
			"Digital package required",
			http.StatusForbidden,
		)

		return
	}

	if subscriber.Amount > 30 {
		http.Error(
			w,
			"Debt limit exceeded",
			http.StatusForbidden,
		)

		return
	}

	/*
		Проверяем камеру.
	*/

	cam := strings.TrimSpace(
		r.URL.Query().Get("cam"),
	)

	if !isPublicCamera(cam) {
		http.Error(
			w,
			"Invalid camera",
			http.StatusBadRequest,
		)

		return
	}

	/*
		Получаем список файлов.

		Сейчас backend по-прежнему поддерживает
		до 6 чанков, хотя frontend передаёт один.
	*/

	rawFiles := strings.Split(
		r.URL.Query().Get("files"),
		",",
	)

	if len(rawFiles) == 0 ||
		len(rawFiles) > 6 {

		http.Error(
			w,
			"Select from 1 to 6 files",
			http.StatusBadRequest,
		)

		return
	}

	times := make(
		[]int64,
		0,
		len(rawFiles),
	)

	seen := make(
		map[int64]bool,
	)

	for _, raw := range rawFiles {
		unix, err := strconv.ParseInt(
			strings.TrimSpace(raw),
			10,
			64,
		)

		if err != nil ||
			unix <= 0 {

			http.Error(
				w,
				"Invalid file",
				http.StatusBadRequest,
			)

			return
		}

		if seen[unix] {
			continue
		}

		seen[unix] = true

		times = append(
			times,
			unix,
		)
	}

	if len(times) == 0 ||
		len(times) > 6 {

		http.Error(
			w,
			"Invalid file count",
			http.StatusBadRequest,
		)

		return
	}

	// Всегда отдаём в хронологическом порядке.
	sort.Slice(
		times,
		func(i, j int) bool {
			return times[i] <
				times[j]
		},
	)

	paths := make(
		[]string,
		0,
		len(times),
	)

	var totalSize int64

	for _, unix := range times {
		path := filepath.Join(
			config.Cams.Dir,
			cam,
			fmt.Sprintf(
				"%d.ts",
				unix,
			),
		)

		info, err := os.Stat(path)

		if err != nil ||
			info.IsDir() {

			http.Error(
				w,
				"Camera chunk not found",
				http.StatusNotFound,
			)

			return
		}

		paths = append(
			paths,
			path,
		)

		totalSize += info.Size()
	}

	firstTime := time.Unix(
		times[0],
		0,
	).In(time.Local)

	saveCameraArchiveLog(
		cam,
		times[0],
		personal,
		surname,
		getClientIP(r),
		r.UserAgent(),
		CameraArchiveTypeDownload,
	)

	fileName := fmt.Sprintf(
		"%s_%s.ts",
		cam,
		firstTime.Format(
			"2006-01-02_150405",
		),
	)

	w.Header().Set(
		"Content-Type",
		"video/mp2t",
	)

	w.Header().Set(
		"Content-Disposition",
		fmt.Sprintf(
			`attachment; filename="%s"`,
			fileName,
		),
	)

	w.Header().Set(
		"Content-Length",
		strconv.FormatInt(
			totalSize,
			10,
		),
	)

	for _, path := range paths {
		file, err := os.Open(path)
		if err != nil {
			return
		}

		_, copyErr := io.Copy(
			w,
			file,
		)

		file.Close()

		if copyErr != nil {
			return
		}
	}
}
