package models

import "time"

type MeteoSensor struct {
	ID uint `gorm:"primaryKey" json:"id"`

	SensorID uint `gorm:"not null;uniqueIndex:idx_meteo_sensor_time,priority:1" json:"sensor_id"`

	AHT20      bool   `json:"aht20"`
	BMP280     bool   `json:"bmp280"`
	BMPAddress string `gorm:"size:4" json:"bmp_address"`

	TemperatureC    *float64 `json:"temperature_c"`
	HumidityPercent *float64 `json:"humidity_percent"`
	PressureMMHg    *float64 `gorm:"column:pressure_mmhg" json:"pressure_mmhg"`

	MeasuredAt time.Time `gorm:"not null;uniqueIndex:idx_meteo_sensor_time,priority:2;index" json:"measured_at"`
}

type MeteoSensorHourly struct {
	ID uint `gorm:"primaryKey" json:"id"`

	SensorID uint `gorm:"not null;uniqueIndex:idx_meteo_sensor_hour,priority:1" json:"sensor_id"`

	Hour time.Time `gorm:"not null;uniqueIndex:idx_meteo_sensor_hour,priority:2;index" json:"hour"`

	TemperatureAvg *float64 `json:"temperature_avg"`
	TemperatureMin *float64 `json:"temperature_min"`
	TemperatureMax *float64 `json:"temperature_max"`

	HumidityAvg *float64 `json:"humidity_avg"`
	HumidityMin *float64 `json:"humidity_min"`
	HumidityMax *float64 `json:"humidity_max"`

	PressureAvg *float64 `json:"pressure_avg"`
	PressureMin *float64 `json:"pressure_min"`
	PressureMax *float64 `json:"pressure_max"`

	Samples uint `gorm:"not null" json:"samples"`
}

func (MeteoSensorHourly) TableName() string {
	return "meteo_sensor_hourly"
}

// получить температуру sensor_id=1 за последние сутки:
// var rows []models.MeteoSensor
// from := time.Now().Add(-24 * time.Hour)
// err := db.
// 	Where("sensor_id = ? AND measured_at >= ?", 1, from).
// 	Order("measured_at ASC").
// 	Find(&rows).Error
