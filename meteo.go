package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"main/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

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

			// Если приложение перезапустилось несколько раз
			// в течение одной минуты, дубль не создаём.
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
