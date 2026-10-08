package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type camChunk struct {
	Unix int64
	Path string
}

func camsWorker() {
	dir := strings.TrimSpace(config.Cams.Dir)

	if dir == "" {
		slog("Cams worker disabled: cams.dir is empty", "info")
		return
	}

	if config.Cams.Depth <= 0 {
		slog("Cams worker disabled: cams.depth <= 0", "info")
		return
	}

	slog(
		fmt.Sprintf(
			"Cams worker started: dir=%s depth=%dh",
			dir,
			config.Cams.Depth,
		),
		"info",
	)

	// Первый проход сразу после запуска.
	processCameras()

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		processCameras()
	}
}

func processCameras() {
	root := strings.TrimSpace(config.Cams.Dir)

	entries, err := os.ReadDir(root)
	if err != nil {
		slog(
			"Cams read dir error: "+err.Error(),
			"error",
		)
		return
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		camDir := filepath.Join(
			root,
			entry.Name(),
		)

		if err := processCameraDir(camDir); err != nil {
			slog(
				fmt.Sprintf(
					"Cams %s error: %v",
					entry.Name(),
					err,
				),
				"error",
			)
		}
	}
}

func processCameraDir(dir string) error {
	chunks, err := getCameraChunks(dir)
	if err != nil {
		return err
	}

	// Берём последний TS — это текущий пишущийся чанк.
	// Если данных уже достаточно, пытаемся сделать из него превью.
	if len(chunks) >= 1 {
		chunk := chunks[len(chunks)-1]

		if err := makeCurrentCameraPreview(chunk); err != nil {
			slog(
				fmt.Sprintf(
					"Cams preview error %s: %v",
					chunk.Path,
					err,
				),
				"error",
			)
		}
	}

	// После создания превью чистим архив.
	if err := cleanupCameraDir(dir); err != nil {
		return err
	}

	return nil
}

func makeCurrentCameraPreview(chunk camChunk) error {
	info, err := os.Stat(chunk.Path)
	if err != nil {
		return err
	}

	// Файл должен хотя бы немного накопиться.
	if info.Size() < 1024*1024 {
		return nil
	}

	// После начала чанка должно пройти хотя бы 5 секунд.
	if time.Now().Unix()-chunk.Unix < 5 {
		return nil
	}

	jpgPath := filepath.Join(
		filepath.Dir(chunk.Path),
		fmt.Sprintf("%d.jpg", chunk.Unix),
	)

	// Скрин уже есть — повторно ffmpeg не запускаем.
	if _, err := os.Stat(jpgPath); err == nil {
		return nil
	}

	tmpPath := jpgPath + ".tmp.jpg"

	_ = os.Remove(tmpPath)

	cmd := exec.Command(
		"ffmpeg",
		"-hide_banner",
		"-loglevel", "error",

		"-ss", "2",
		"-i", chunk.Path,

		"-frames:v", "1",
		"-vf", "scale=300:200",
		"-q:v", "4",

		"-y",
		tmpPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		_ = os.Remove(tmpPath)

		return fmt.Errorf(
			"ffmpeg: %w: %s",
			err,
			strings.TrimSpace(string(output)),
		)
	}

	info, err = os.Stat(tmpPath)
	if err != nil {
		return fmt.Errorf(
			"preview not created: %w",
			err,
		)
	}

	if info.Size() == 0 {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("preview is empty")
	}

	if err := os.Rename(tmpPath, jpgPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf(
			"rename preview: %w",
			err,
		)
	}

	if debug {
		slog(
			fmt.Sprintf(
				"Cams preview created: %s",
				jpgPath,
			),
			"debug",
		)
	}

	return nil
}

func getCameraChunks(dir string) ([]camChunk, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	chunks := make(
		[]camChunk,
		0,
		len(entries),
	)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()

		if strings.ToLower(
			filepath.Ext(name),
		) != ".ts" {
			continue
		}

		base := strings.TrimSuffix(
			name,
			filepath.Ext(name),
		)

		ts, err := strconv.ParseInt(
			base,
			10,
			64,
		)

		if err != nil {
			// Файлы не вида <unix>.ts просто игнорируем.
			continue
		}

		chunks = append(
			chunks,
			camChunk{
				Unix: ts,
				Path: filepath.Join(
					dir,
					name,
				),
			},
		)
	}

	sort.Slice(
		chunks,
		func(i, j int) bool {
			return chunks[i].Unix <
				chunks[j].Unix
		},
	)

	return chunks, nil
}

func cleanupCameraDir(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	cutoff := time.Now().
		Add(
			-time.Duration(config.Cams.Depth) *
				time.Hour,
		).
		Unix()

	var (
		deleted  int
		failed   int
		firstErr error
	)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()

		ext := strings.ToLower(
			filepath.Ext(name),
		)

		if ext != ".ts" &&
			ext != ".jpg" {
			continue
		}

		base := strings.TrimSuffix(
			name,
			filepath.Ext(name),
		)

		fileUnix, err := strconv.ParseInt(
			base,
			10,
			64,
		)

		if err != nil {
			continue
		}

		if fileUnix >= cutoff {
			continue
		}

		path := filepath.Join(
			dir,
			name,
		)

		if err := os.Remove(path); err != nil {
			failed++

			if firstErr == nil {
				firstErr = err
			}

			continue
		}

		deleted++
	}

	if failed > 0 {
		slog(
			fmt.Sprintf(
				"Cams cleanup %s: deleted=%d failed=%d first_error=%v",
				dir,
				deleted,
				failed,
				firstErr,
			),
			"error",
		)
	} else if deleted > 0 {
		slog(
			fmt.Sprintf(
				"Cams cleanup %s: deleted=%d",
				dir,
				deleted,
			),
			"info",
		)
	}

	return nil
}
