package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var cameraNameRE = regexp.MustCompile(`^cam[0-9]+$`)

type CameraAPIItem struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Preview int64   `json:"preview"`
	Frames  []int64 `json:"frames"`
}

type CameraChunkAPI struct {
	Unix       int64 `json:"unix"`
	Size       int64 `json:"size"`
	HasPreview bool  `json:"has_preview"`
	Active     bool  `json:"active"`
}

func apiGuestPlayCamera(
	ctx *ApiCtx,
) map[string]any {

	personal := strings.TrimSpace(
		ctx.D["personal"],
	)

	surname := strings.TrimSpace(
		ctx.D["surname"],
	)

	cam := strings.TrimSpace(
		ctx.D["cam"],
	)

	unixText := strings.TrimSpace(
		ctx.D["time"],
	)

	/*
		Проверяем входные данные.
	*/

	if personal == "" ||
		surname == "" {

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Необходимо указать данные абонента"

		return ctx.Out
	}

	if !isPublicCamera(cam) {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Некорректная камера"

		return ctx.Out
	}

	unix, err := strconv.ParseInt(
		unixText,
		10,
		64,
	)

	if err != nil ||
		unix <= 0 {

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Некорректное время"

		return ctx.Out
	}

	/*
		Каждый раз получаем свежие
		данные абонента из базы.
	*/

	subscriber, err :=
		checkSubscriber(
			personal,
			surname,
		)

	if err != nil {
		slog(
			"camera play subscriber check: "+
				err.Error(),
			"error",
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Не удалось проверить данные абонента"

		return ctx.Out
	}

	if !subscriber.Found {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Лицевой счёт или фамилия указаны неверно"

		return ctx.Out
	}

	if !strings.EqualFold(
		strings.TrimSpace(
			subscriber.Tarif,
		),
		"Цифровой пакет",
	) {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Сервис архива камер доступен только абонентам цифрового пакета"

		return ctx.Out
	}

	if subscriber.Amount > 30 {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Для доступа к архиву камер задолженность абонента не должна превышать 30 рублей"

		return ctx.Out
	}

	/*
		Проверяем существование TS.
	*/

	tsPath := filepath.Join(
		config.Cams.Dir,
		cam,
		fmt.Sprintf(
			"%d.ts",
			unix,
		),
	)

	info, err := os.Stat(
		tsPath,
	)

	if err != nil ||
		info.IsDir() ||
		info.Size() == 0 {

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Запись камеры не найдена"

		return ctx.Out
	}

	/*
		Дальше начинается критическая секция.

		Пока мы проверяем владельца,
		пишем play.lua и рестартуем Astra,
		второй запрос сюда не попадёт.
	*/

	cameraPlayState.Lock()
	defer cameraPlayState.Unlock()

	now := time.Now()

	/*
		Если предыдущая блокировка истекла,
		сбрасываем владельца.
	*/

	if !cameraPlayState.Until.IsZero() &&
		!now.Before(
			cameraPlayState.Until,
		) {

		cameraPlayState.Personal = ""
		cameraPlayState.Surname = ""
		cameraPlayState.Until =
			time.Time{}
	}

	/*
		Есть действующая блокировка.

		Разрешаем управление только тому
		абоненту, который её получил.
	*/

	if now.Before(
		cameraPlayState.Until,
	) {
		sameSubscriber :=
			cameraPlayState.Personal ==
				personal &&
				strings.EqualFold(
					cameraPlayState.Surname,
					surname,
				)

		if !sameSubscriber {
			left := time.Until(
				cameraPlayState.Until,
			)

			seconds :=
				int(left.Seconds())

			if seconds < 1 {
				seconds = 1
			}

			ctx.Out["status"] = "NOK"

			ctx.Out["error"] =
				fmt.Sprintf(
					"Архив сейчас воспроизводится другим абонентом. Повторите через %d мин.",
					(seconds+59)/60,
				)

			ctx.Out["busy"] = true

			ctx.Out["retry_after"] =
				seconds

			return ctx.Out
		}
	}

	/*
		Формируем play.lua.

		Первым идёт выбранный файл.
		После него Astra будет бесконечно
		крутить default.ts.
	*/

	inputPath :=
		filepath.ToSlash(
			tsPath,
		)

	lua := fmt.Sprintf(
		`make_channel({
  name = 'astra',
  input = {'file://%s#set_pnr=1&map.video=101&map.audio=102&map.pmt=100&bitrate_limit=32', 'file:///usr/src/cameras/default.ts#loop&set_pnr=1&map.video=101&map.audio=102&map.pmt=100&bitrate_limit=32'},
  output = {'udp://192.168.2.15@239.1.100.100'}
})
`,
		inputPath,
	)

	/*
		Пишем сначала временный файл,
		затем rename.

		Таким образом cameras никогда
		не увидит наполовину записанный
		play.lua.
	*/

	tmpPath :=
		cameraPlayLuaPath +
			".tmp"

	err = os.WriteFile(
		tmpPath,
		[]byte(lua),
		0644,
	)

	if err != nil {
		slog(
			"camera play write temp: "+
				err.Error(),
			"error",
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Не удалось запустить воспроизведение"

		return ctx.Out
	}

	err = os.Rename(
		tmpPath,
		cameraPlayLuaPath,
	)

	if err != nil {
		_ = os.Remove(
			tmpPath,
		)

		slog(
			"camera play rename: "+
				err.Error(),
			"error",
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Не удалось запустить воспроизведение"

		return ctx.Out
	}

	/*
		Перезапускаем Astra.
	*/

	saveCameraArchiveLog(
		cam,
		unix,
		personal,
		surname,
		getClientIP(ctx.R),
		ctx.R.UserAgent(),
		CameraArchiveTypePlay,
	)

	cmd := exec.Command(
		"sudo",
		"/usr/bin/systemctl",
		"restart",
		"cameras.service",
	)

	output, err :=
		cmd.CombinedOutput()

	if err != nil {
		slog(
			fmt.Sprintf(
				"camera play restart error: %v: %s",
				err,
				strings.TrimSpace(
					string(output),
				),
			),
			"error",
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Не удалось запустить воспроизведение"

		return ctx.Out
	}

	/*
		Только после успешного restart
		назначаем/продлеваем владельца.
	*/

	cameraPlayState.Personal =
		personal

	cameraPlayState.Surname =
		surname

	cameraPlayState.Until =
		time.Now().Add(
			cameraPlayLockDuration,
		)

	ctx.Out["playing"] = true

	ctx.Out["cam"] = cam
	ctx.Out["time"] = unix

	ctx.Out["locked_until"] =
		cameraPlayState.Until.Unix()

	ctx.Out["lock_seconds"] =
		int(
			cameraPlayLockDuration.Seconds(),
		)

	return ctx.Out
}

func apiGuestGetCameras(c *ApiCtx) map[string]any {
	root := strings.TrimSpace(config.Cams.Dir)

	if root == "" {
		c.Out["status"] = "NOK"
		c.Out["error"] = "Cameras directory is empty"
		return c.Out
	}

	cameras, err := getCameraList(root)
	if err != nil {
		c.Out["status"] = "NOK"
		c.Out["error"] = err.Error()
		return c.Out
	}

	if len(cameras) == 0 {
		c.Out["status"] = "NOK"
		c.Out["error"] = "Cameras not found"
		return c.Out
	}

	// Собираем общий список дат по всем публичным камерам.
	dateMap := make(map[string]bool)

	for _, camera := range cameras {
		camDir := filepath.Join(root, camera.ID)

		chunks, err := getCameraChunks(camDir)
		if err != nil {
			continue
		}

		for _, chunk := range chunks {
			date := time.Unix(chunk.Unix, 0).
				In(time.Local).
				Format("2006-01-02")

			dateMap[date] = true
		}
	}

	dates := make([]string, 0, len(dateMap))

	for date := range dateMap {
		dates = append(dates, date)
	}

	// Новые даты сверху.
	sort.Sort(sort.Reverse(sort.StringSlice(dates)))

	// Выбранная дата.
	selectedDate := strings.TrimSpace(c.D["date"])

	if !dateMap[selectedDate] {
		if len(dates) > 0 {
			selectedDate = dates[0]
		} else {
			selectedDate = ""
		}
	}

	if selectedDate == "" {
		c.Out["date"] = ""
		c.Out["dates"] = dates
		c.Out["cameras"] = cameras
		return c.Out
	}

	// Целевое время: выбранная дата + текущее время суток.
	now := time.Now()

	selectedDay, err := time.ParseInLocation(
		"2006-01-02",
		selectedDate,
		time.Local,
	)
	if err != nil {
		c.Out["status"] = "NOK"
		c.Out["error"] = "Invalid date"
		return c.Out
	}

	targetTime := time.Date(
		selectedDay.Year(),
		selectedDay.Month(),
		selectedDay.Day(),
		now.Hour(),
		now.Minute(),
		now.Second(),
		0,
		time.Local,
	)

	targetUnix := targetTime.Unix()

	// Для каждой камеры ищем JPG выбранного дня.
	// preview — кадр, ближайший к текущему времени суток.
	// frames — все доступные кадры выбранного дня.

	outCameras := make(
		[]CameraAPIItem,
		0,
		len(cameras),
	)

	for _, camera := range cameras {
		camDir := filepath.Join(
			root,
			camera.ID,
		)

		chunks, err := getCameraChunks(
			camDir,
		)

		if err != nil {
			camera.Preview = 0
			camera.Frames = []int64{}

			outCameras = append(
				outCameras,
				camera,
			)

			continue
		}

		var (
			preview  int64
			bestDiff int64 = -1
		)

		frames := make(
			[]int64,
			0,
		)

		for _, chunk := range chunks {
			chunkTime := time.Unix(
				chunk.Unix,
				0,
			).In(time.Local)

			// Берём только выбранный день.
			if chunkTime.Format(
				"2006-01-02",
			) != selectedDate {
				continue
			}

			jpgPath := filepath.Join(
				camDir,
				fmt.Sprintf(
					"%d.jpg",
					chunk.Unix,
				),
			)

			info, err := os.Stat(
				jpgPath,
			)

			if err != nil {
				continue
			}

			if info.IsDir() ||
				info.Size() == 0 {
				continue
			}

			// Этот кадр реально существует.
			frames = append(
				frames,
				chunk.Unix,
			)

			// Ищем кадр максимально близкий
			// к текущему времени суток.
			diff :=
				chunk.Unix -
					targetUnix

			if diff < 0 {
				diff = -diff
			}

			if bestDiff == -1 ||
				diff < bestDiff {

				bestDiff = diff
				preview = chunk.Unix
			}
		}

		camera.Preview = preview
		camera.Frames = frames

		outCameras = append(
			outCameras,
			camera,
		)
	}

	c.Out["date"] = selectedDate
	c.Out["dates"] = dates
	c.Out["cameras"] = outCameras

	return c.Out
}

func getCameraList(root string) ([]CameraAPIItem, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	cameras := make(
		[]CameraAPIItem,
		0,
	)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()

		if name == "cam9" {
			continue
		}

		if !cameraNameRE.MatchString(name) {
			continue
		}

		number := strings.TrimPrefix(
			name,
			"cam",
		)

		cameras = append(
			cameras,
			CameraAPIItem{
				ID: name,
				Name: fmt.Sprintf(
					"Камера %s",
					number,
				),
			},
		)
	}

	sort.Slice(
		cameras,
		func(i, j int) bool {
			ni, _ := strconv.Atoi(
				strings.TrimPrefix(
					cameras[i].ID,
					"cam",
				),
			)

			nj, _ := strconv.Atoi(
				strings.TrimPrefix(
					cameras[j].ID,
					"cam",
				),
			)

			return ni < nj
		},
	)

	return cameras, nil
}

func cameraInList(
	cameras []CameraAPIItem,
	cam string,
) bool {

	for _, item := range cameras {
		if item.ID == cam {
			return true
		}
	}

	return false
}

func isPublicCamera(cam string) bool {
	if cam == "cam9" {
		return false
	}

	return cameraNameRE.MatchString(cam)
}
