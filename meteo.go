package main

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"io"
	"net/http"
	"strings"
	"time"

	"main/models"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const meteoMaxTemperatureJump = 5.0

type MeteoResponse struct {
	Sensors []struct {
		ID              uint     `json:"id"`
		AHT20           bool     `json:"aht20"`
		BMP280          bool     `json:"bmp280"`
		BMPAddress      string   `json:"bmp_address"`
		TemperatureC    *float64 `json:"temperature_c"`
		HumidityPercent *float64 `json:"humidity_percent"`
		PressureMMHg    *float64 `json:"pressure_mmhg"`
	} `json:"sensors"`

	DS18B20 []struct {
		Address      string   `json:"address"`
		TemperatureC *float64 `json:"temperature_c"`
	} `json:"ds18b20"`
}

var meteoHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
}

func isMeteoTemperatureValid(
	tx *gorm.DB,
	sensorID uint,
	current *float64,
) (bool, error) {
	if current == nil {
		return true, nil
	}

	var last models.MeteoSensor

	err := tx.
		Where("sensor_id = ? AND temperature_c IS NOT NULL", sensorID).
		Order("measured_at DESC").
		First(&last).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Первое измерение — сравнивать пока не с чем.
			return true, nil
		}

		return false, err
	}

	if last.TemperatureC == nil {
		return true, nil
	}

	diff := *current - *last.TemperatureC

	if diff < 0 {
		diff = -diff
	}

	return diff <= meteoMaxTemperatureJump, nil
}

// meteoWorker:
//   - сразу после запуска получает текущие данные;
//   - затем получает данные каждую минуту;
//   - один раз в сутки агрегирует данные старше года;
//   - после успешной агрегации удаляет старые минутные данные.
//
// Из main.go достаточно:
//
//	go meteoWorker()
func meteoWorker() {
	if strings.TrimSpace(config.App.Meteo) == "" {
		slog("Meteo collector disabled: app.meteo is empty", "info")
		return
	}

	slog("Meteo collector started: "+config.App.Meteo, "info")

	// Первый опрос сразу после запуска.
	collectMeteo()

	// При старте также проверяем, нет ли данных старше года.
	if err := aggregateOldMeteoData(); err != nil {
		slog("Meteo aggregate error: "+err.Error(), "error")
	}

	collectTicker := time.NewTicker(time.Minute)
	defer collectTicker.Stop()

	// Проверяем необходимость агрегации раз в минуту,
	// но реально запускаем её только один раз в сутки после 03:10.
	lastCleanupDate := ""

	for {
		<-collectTicker.C

		collectMeteo()

		now := time.Now()

		// Агрегация запускается один раз в сутки после 03:10.
		if now.Hour() == 3 && now.Minute() >= 10 {
			today := now.Format("2006-01-02")

			if lastCleanupDate != today {
				if err := aggregateOldMeteoData(); err != nil {
					slog("Meteo aggregate error: "+err.Error(), "error")
				} else {
					lastCleanupDate = today
				}
			}
		}
	}
}

// collectMeteo получает JSON с метеостанции
// и сохраняет все значения одного запроса с одинаковым measured_at.
func collectMeteo() {
	data, err := getMeteo()
	if err != nil {
		slog("Meteo GET error: "+err.Error(), "error")
		return
	}

	measuredAt := time.Now().Truncate(time.Minute)

	err = db.Transaction(func(tx *gorm.DB) error {
		for _, sensor := range data.Sensors {
			valid, err := isMeteoTemperatureValid(
				tx,
				sensor.ID,
				sensor.TemperatureC,
			)
			if err != nil {
				return fmt.Errorf(
					"check sensor %d temperature: %w",
					sensor.ID,
					err,
				)
			}

			if !valid {
				if debug {
					slog(
						fmt.Sprintf(
							"Meteo sensor %d skipped: temperature jump %.2f C",
							sensor.ID,
							*sensor.TemperatureC,
						),
						"debug",
					)
				}

				continue
			}

			row := models.MeteoSensor{
				SensorID:        sensor.ID,
				AHT20:           sensor.AHT20,
				BMP280:          sensor.BMP280,
				BMPAddress:      sensor.BMPAddress,
				TemperatureC:    sensor.TemperatureC,
				HumidityPercent: sensor.HumidityPercent,
				PressureMMHg:    sensor.PressureMMHg,
				MeasuredAt:      measuredAt,
			}

			if err := tx.
				Clauses(clause.OnConflict{DoNothing: true}).
				Create(&row).Error; err != nil {

				return fmt.Errorf(
					"save sensor %d: %w",
					sensor.ID,
					err,
				)
			}
		}

		for _, sensor := range data.DS18B20 {
			row := models.MeteoDS18B20{
				Address:      sensor.Address,
				TemperatureC: sensor.TemperatureC,
				MeasuredAt:   measuredAt,
			}

			if err := tx.
				Clauses(clause.OnConflict{DoNothing: true}).
				Create(&row).Error; err != nil {

				return fmt.Errorf(
					"save DS18B20 %s: %w",
					sensor.Address,
					err,
				)
			}
		}

		return nil
	})

	if err != nil {
		slog("Meteo DB error: "+err.Error(), "error")
		return
	}

	if debug {
		slog(
			fmt.Sprintf(
				"Meteo saved: %d sensors, %d DS18B20",
				len(data.Sensors),
				len(data.DS18B20),
			),
			"debug",
		)
	}
}

// getMeteo получает JSON с ESP32.
//
// При:
//
//	meteo = 192.168.1.99
//
// запрос будет:
//
//	http://192.168.1.99/
func getMeteo() (*MeteoResponse, error) {
	host := strings.TrimSpace(config.App.Meteo)

	if host == "" {
		return nil, fmt.Errorf("meteo address is empty")
	}

	url := host

	// Можно оставить в config.ini просто IP:
	//
	// meteo = 192.168.1.99
	//
	// либо при необходимости полный URL:
	//
	// meteo = http://192.168.1.99/
	if !strings.HasPrefix(url, "http://") &&
		!strings.HasPrefix(url, "https://") {
		url = "http://" + url
	}

	if !strings.HasSuffix(url, "/") {
		url += "/"
	}

	resp, err := meteoHTTPClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf(
			"HTTP %d %s",
			resp.StatusCode,
			resp.Status,
		)
	}

	// Ответ от ESP32 маленький.
	// Ограничение защищает сервер от случайно огромного ответа.
	body, err := io.ReadAll(
		io.LimitReader(resp.Body, 1024*1024),
	)
	if err != nil {
		return nil, err
	}

	var result MeteoResponse

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf(
			"JSON decode: %w",
			err,
		)
	}

	return &result, nil
}

// aggregateOldMeteoData:
//
//  1. находит MeteoSensor старше 365 дней;
//  2. группирует их по sensor_id + часу;
//  3. сохраняет AVG/MIN/MAX в meteo_sensor_hourly;
//  4. после успешного сохранения удаляет минутные данные.
//
// DS18B20 здесь специально не участвует.
func aggregateOldMeteoData() error {
	// Берём только полностью закончившиеся часы.
	//
	// Например, если сейчас:
	//
	// 2026-10-02 07:37
	//
	// cutoff будет:
	//
	// 2025-10-02 07:00
	//
	// Всё раньше этого времени можно агрегировать.
	cutoff := time.Now().
		AddDate(0, 0, -365).
		Truncate(time.Hour)

	type AggregateRow struct {
		SensorID uint      `gorm:"column:sensor_id"`
		Hour     time.Time `gorm:"column:hour"`

		TemperatureAvg *float64 `gorm:"column:temperature_avg"`
		TemperatureMin *float64 `gorm:"column:temperature_min"`
		TemperatureMax *float64 `gorm:"column:temperature_max"`

		HumidityAvg *float64 `gorm:"column:humidity_avg"`
		HumidityMin *float64 `gorm:"column:humidity_min"`
		HumidityMax *float64 `gorm:"column:humidity_max"`

		PressureAvg *float64 `gorm:"column:pressure_avg"`
		PressureMin *float64 `gorm:"column:pressure_min"`
		PressureMax *float64 `gorm:"column:pressure_max"`

		Samples uint `gorm:"column:samples"`
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var rows []AggregateRow

		err := tx.Raw(`
			SELECT
				sensor_id,

				TIMESTAMP(
					DATE(measured_at),
					MAKETIME(HOUR(measured_at), 0, 0)
				) AS hour,

				AVG(temperature_c) AS temperature_avg,
				MIN(temperature_c) AS temperature_min,
				MAX(temperature_c) AS temperature_max,

				AVG(humidity_percent) AS humidity_avg,
				MIN(humidity_percent) AS humidity_min,
				MAX(humidity_percent) AS humidity_max,

				AVG(pressure_mmhg) AS pressure_avg,
				MIN(pressure_mmhg) AS pressure_min,
				MAX(pressure_mmhg) AS pressure_max,

				COUNT(*) AS samples

			FROM meteo_sensors

			WHERE measured_at < ?

			GROUP BY
				sensor_id,
				DATE(measured_at),
				HOUR(measured_at)

			ORDER BY
				sensor_id,
				hour
		`, cutoff).Scan(&rows).Error

		if err != nil {
			return fmt.Errorf(
				"select old meteo data: %w",
				err,
			)
		}

		if len(rows) == 0 {
			if debug {
				slog(
					"Meteo aggregate: nothing to aggregate",
					"debug",
				)
			}

			return nil
		}

		for _, row := range rows {
			item := models.MeteoSensorHourly{
				SensorID: row.SensorID,
				Hour:     row.Hour,

				TemperatureAvg: row.TemperatureAvg,
				TemperatureMin: row.TemperatureMin,
				TemperatureMax: row.TemperatureMax,

				HumidityAvg: row.HumidityAvg,
				HumidityMin: row.HumidityMin,
				HumidityMax: row.HumidityMax,

				PressureAvg: row.PressureAvg,
				PressureMin: row.PressureMin,
				PressureMax: row.PressureMax,

				Samples: row.Samples,
			}

			// Если этот час уже был агрегирован,
			// обновляем существующую строку.
			//
			// Это делает процесс безопасным при повторном запуске.
			err := tx.
				Clauses(clause.OnConflict{
					Columns: []clause.Column{
						{Name: "sensor_id"},
						{Name: "hour"},
					},

					DoUpdates: clause.AssignmentColumns([]string{
						"temperature_avg",
						"temperature_min",
						"temperature_max",

						"humidity_avg",
						"humidity_min",
						"humidity_max",

						"pressure_avg",
						"pressure_min",
						"pressure_max",

						"samples",
					}),
				}).
				Create(&item).Error

			if err != nil {
				return fmt.Errorf(
					"save hourly sensor %d %s: %w",
					row.SensorID,
					row.Hour.Format("2006-01-02 15:04:05"),
					err,
				)
			}
		}

		// Удаляем минутные значения только после того,
		// как ВСЕ агрегированные значения успешно сохранены.
		result := tx.
			Where("measured_at < ?", cutoff).
			Delete(&models.MeteoSensor{})

		if result.Error != nil {
			return fmt.Errorf(
				"delete old meteo data: %w",
				result.Error,
			)
		}

		slog(
			fmt.Sprintf(
				"Meteo aggregate: %d hourly rows, %d minute rows deleted, cutoff %s",
				len(rows),
				result.RowsAffected,
				cutoff.Format("2006-01-02 15:04:05"),
			),
			"info",
		)

		return nil
	})
}

//      ██╗██████╗ ███████╗ ██████╗
//      ██║██╔══██╗██╔════╝██╔════╝
//      ██║██████╔╝█████╗  ██║  ███╗
// ██   ██║██╔═══╝ ██╔══╝  ██║   ██║
// ╚█████╔╝██║     ███████╗╚██████╔╝
//  ╚════╝ ╚═╝     ╚══════╝ ╚═════╝

type meteoChartRow struct {
	MeasuredAt      time.Time `gorm:"column:measured_at"`
	TemperatureC    *float64  `gorm:"column:temperature_c"`
	HumidityPercent *float64  `gorm:"column:humidity_percent"`
	PressureMMHg    *float64  `gorm:"column:pressure_mmhg"`
}

type meteoPoint struct {
	Time  time.Time
	Value float64
}

func meteoJPGHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	now := time.Now()
	from := now.AddDate(0, 0, -7)

	var rows []meteoChartRow

	// Сглаживаем по 10 минут, чтобы не рисовать 10000+ точек
	err := db.Raw(`
		SELECT
			FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(measured_at) / 600) * 600) AS measured_at,
			AVG(temperature_c)    AS temperature_c,
			AVG(humidity_percent) AS humidity_percent,
			AVG(pressure_mmhg)    AS pressure_mmhg
		FROM meteo_sensors
		WHERE sensor_id = ? AND measured_at >= ? AND measured_at <= ?
		GROUP BY FLOOR(UNIX_TIMESTAMP(measured_at) / 600)
		ORDER BY measured_at
	`, 1, from, now).Scan(&rows).Error
	if err != nil {
		slog("Meteo chart DB error: "+err.Error(), "error")
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if len(rows) == 0 {
		http.Error(w, "No meteo data", http.StatusNotFound)
		return
	}

	var tempPoints []meteoPoint
	var humPoints []meteoPoint
	var presPoints []meteoPoint

	for _, row := range rows {
		if row.TemperatureC != nil {
			tempPoints = append(tempPoints, meteoPoint{Time: row.MeasuredAt, Value: *row.TemperatureC})
		}
		if row.HumidityPercent != nil {
			humPoints = append(humPoints, meteoPoint{Time: row.MeasuredAt, Value: *row.HumidityPercent})
		}
		if row.PressureMMHg != nil {
			presPoints = append(presPoints, meteoPoint{Time: row.MeasuredAt, Value: *row.PressureMMHg})
		}
	}

	const (
		width  = 800
		height = 400
	)

	img := image.NewRGBA(image.Rect(0, 0, width, height))

	white := color.RGBA{255, 255, 255, 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: white}, image.Point{}, draw.Src)

	gray := color.RGBA{220, 220, 220, 255}
	textGray := color.RGBA{100, 100, 100, 255}

	red := color.RGBA{220, 70, 60, 255}
	blue := color.RGBA{50, 110, 220, 255}
	green := color.RGBA{40, 150, 80, 255}

	plot := image.Rect(30, 63, 780, 333)

	// Рамка графика
	drawLine(img, plot.Min.X, plot.Min.Y, plot.Max.X, plot.Min.Y, gray)
	drawLine(img, plot.Max.X, plot.Min.Y, plot.Max.X, plot.Max.Y, gray)
	drawLine(img, plot.Max.X, plot.Max.Y, plot.Min.X, plot.Max.Y, gray)
	drawLine(img, plot.Min.X, plot.Max.Y, plot.Min.X, plot.Min.Y, gray)

	// Горизонтальная сетка
	for i := 0; i <= 4; i++ {
		y := plot.Min.Y + i*(plot.Dy())/4
		drawLine(img, plot.Min.X, y, plot.Max.X, y, gray)
	}

	// Вертикальные линии по дням
	day := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, from.Location()).AddDate(0, 0, 1)
	for !day.After(now) {
		x := timeToX(day, from, now, plot.Min.X, plot.Max.X)
		drawLine(img, x, plot.Min.Y, x, plot.Max.Y, gray)
		drawText(img, x-15, plot.Max.Y+30, day.Format("02.01"), textGray)
		day = day.AddDate(0, 0, 1)
	}

	// Статистика и линии
	tMin, tMax := minMax(tempPoints)
	hMin, hMax := minMax(humPoints)
	pMin, pMax := minMax(presPoints)

	drawSeriesNormalized(img, plot, tempPoints, from, now, tMin, tMax, red)
	drawSeriesNormalized(img, plot, humPoints, from, now, hMin, hMax, blue)
	drawSeriesNormalized(img, plot, presPoints, from, now, pMin, pMax, green)

	// Легенда
	drawText(img, 40, 37, fmt.Sprintf("T: %.1f..%.1f", tMin, tMax), red)

	if hMax >= 100 {
		hMax = 100
	}

	drawText(img, 280, 37, fmt.Sprintf("H: %.1f..%.1f", hMin, hMax), blue)
	drawText(img, 550, 37, fmt.Sprintf("P: %.1f..%.1f", pMin, pMax), green)

	drawFooter(img, "Метеоданные с сайта TRIANDA.BY")
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	if err := jpeg.Encode(w, img, &jpeg.Options{Quality: 90}); err != nil {
		slog("Meteo JPEG encode error: "+err.Error(), "error")
	}
}

func drawSeriesNormalized(
	img *image.RGBA,
	plot image.Rectangle,
	points []meteoPoint,
	from time.Time,
	to time.Time,
	minV float64,
	maxV float64,
	lineColor color.RGBA,
) {
	if len(points) < 2 {
		return
	}

	if maxV <= minV {
		maxV = minV + 1
	}

	prevX := 0
	prevY := 0
	havePrev := false

	for _, p := range points {
		x := timeToX(p.Time, from, to, plot.Min.X, plot.Max.X)
		y := valueToYNormalized(p.Value, minV, maxV, plot.Min.Y, plot.Max.Y)

		if havePrev {
			drawThickLine(img, prevX, prevY, x, y, lineColor, 3)
		}

		prevX = x
		prevY = y
		havePrev = true
	}
}

func minMax(points []meteoPoint) (float64, float64) {
	if len(points) == 0 {
		return 0, 1
	}

	minV := points[0].Value
	maxV := points[0].Value

	for _, p := range points {
		if p.Value < minV {
			minV = p.Value
		}
		if p.Value > maxV {
			maxV = p.Value
		}
	}

	// небольшой отступ
	d := maxV - minV
	if d == 0 {
		d = 1
	}

	minV -= d * 0.05
	maxV += d * 0.05

	return minV, maxV
}

func timeToX(t time.Time, from time.Time, to time.Time, x1 int, x2 int) int {
	total := to.Sub(from).Seconds()
	if total <= 0 {
		return x1
	}

	k := t.Sub(from).Seconds() / total
	if k < 0 {
		k = 0
	}
	if k > 1 {
		k = 1
	}

	return x1 + int(k*float64(x2-x1))
}

func valueToYNormalized(v float64, minV float64, maxV float64, y1 int, y2 int) int {
	if maxV <= minV {
		return (y1 + y2) / 2
	}

	k := (v - minV) / (maxV - minV)
	if k < 0 {
		k = 0
	}
	if k > 1 {
		k = 1
	}

	return y2 - int(k*float64(y2-y1))
}

func meteoTimeX(
	t time.Time,
	from time.Time,
	to time.Time,
	x1 int,
	x2 int,
) int {
	total := to.Sub(from).Seconds()

	if total <= 0 {
		return x1
	}

	pos := t.Sub(from).Seconds() / total

	if pos < 0 {
		pos = 0
	}

	if pos > 1 {
		pos = 1
	}

	return x1 + int(
		pos*float64(x2-x1),
	)
}

func meteoValueY(
	value float64,
	minValue float64,
	maxValue float64,
	y1 int,
	y2 int,
) int {
	if maxValue <= minValue {
		return (y1 + y2) / 2
	}

	k := (value - minValue) /
		(maxValue - minValue)

	if k < 0 {
		k = 0
	}

	if k > 1 {
		k = 1
	}

	return y2 -
		int(k*float64(y2-y1))
}

func drawText(
	img *image.RGBA,
	x int,
	y int,
	text string,
	c color.Color,
) {
	drawTextScaled(img, x, y, text, c, 2, true)
}

func drawTextScaled(
	img *image.RGBA,
	x int,
	y int,
	text string,
	c color.Color,
	scale int,
	bold bool,
) {
	if scale < 1 {
		scale = 1
	}

	face := basicfont.Face7x13
	ascent := face.Metrics().Ascent.Ceil()
	height := face.Metrics().Height.Ceil()
	width := font.MeasureString(face, text).Ceil()

	if width <= 0 || height <= 0 {
		return
	}

	tmp := image.NewRGBA(image.Rect(0, 0, width, height))

	d := &font.Drawer{
		Dst:  tmp,
		Src:  image.NewUniform(c),
		Face: face,
		Dot:  fixed.P(0, ascent),
	}
	d.DrawString(text)

	offsets := [][2]int{{0, 0}}
	if bold {
		offsets = append(offsets,
			[2]int{1, 0},
			[2]int{0, 1},
			[2]int{1, 1},
		)
	}

	for ty := 0; ty < height; ty++ {
		for tx := 0; tx < width; tx++ {
			_, _, _, a := tmp.At(tx, ty).RGBA()
			if a == 0 {
				continue
			}

			baseX := x + tx*scale
			baseY := y - ascent*scale + ty*scale

			for _, off := range offsets {
				fillRect(
					img,
					baseX+off[0],
					baseY+off[1],
					scale,
					scale,
					c,
				)
			}
		}
	}
}

func fillRect(
	img *image.RGBA,
	x int,
	y int,
	w int,
	h int,
	c color.Color,
) {
	b := img.Bounds()

	for yy := 0; yy < h; yy++ {
		py := y + yy
		if py < b.Min.Y || py >= b.Max.Y {
			continue
		}

		for xx := 0; xx < w; xx++ {
			px := x + xx
			if px < b.Min.X || px >= b.Max.X {
				continue
			}

			img.Set(px, py, c)
		}
	}
}

func drawThickLine(
	img *image.RGBA,
	x0 int,
	y0 int,
	x1 int,
	y1 int,
	c color.Color,
	thickness int,
) {
	if thickness <= 1 {
		drawLine(img, x0, y0, x1, y1, c)
		return
	}

	dx := absInt(x1 - x0)
	sx := -1
	if x0 < x1 {
		sx = 1
	}

	dy := -absInt(y1 - y0)
	sy := -1
	if y0 < y1 {
		sy = 1
	}

	errValue := dx + dy
	r := thickness / 2

	for {
		fillRect(img, x0-r, y0-r, thickness, thickness, c)

		if x0 == x1 && y0 == y1 {
			break
		}

		e2 := 2 * errValue

		if e2 >= dy {
			errValue += dy
			x0 += sx
		}

		if e2 <= dx {
			errValue += dx
			y0 += sy
		}
	}
}

func drawLine(
	img *image.RGBA,
	x0 int,
	y0 int,
	x1 int,
	y1 int,
	c color.Color,
) {
	dx := absInt(x1 - x0)
	sx := -1

	if x0 < x1 {
		sx = 1
	}

	dy := -absInt(y1 - y0)
	sy := -1

	if y0 < y1 {
		sy = 1
	}

	errValue := dx + dy

	for {
		if image.Pt(x0, y0).In(img.Bounds()) {
			img.Set(x0, y0, c)
		}

		if x0 == x1 && y0 == y1 {
			break
		}

		e2 := 2 * errValue

		if e2 >= dy {
			errValue += dy
			x0 += sx
		}

		if e2 <= dx {
			errValue += dx
			y0 += sy
		}
	}
}

func absInt(v int) int {
	if v < 0 {
		return -v
	}

	return v
}

func drawFooter(img *image.RGBA, text string) {
	f, err := opentype.Parse(gobold.TTF)
	if err != nil {
		return
	}

	face, err := opentype.NewFace(f, &opentype.FaceOptions{
		Size:    16,
		DPI:     72,
		Hinting: font.HintingFull,
	})
	if err != nil {
		return
	}
	defer face.Close()

	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(color.RGBA{80, 80, 80, 255}),
		Face: face,
	}

	textWidth := d.MeasureString(text).Ceil()

	x := (img.Bounds().Dx() - textWidth) / 2

	// Отступ 10 пикселей от нижнего края.
	y := img.Bounds().Max.Y - 10

	d.Dot = fixed.P(x, y)
	d.DrawString(text)
}
