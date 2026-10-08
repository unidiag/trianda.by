package models

import "time"

type MeteoDS18B20 struct {
	ID uint `gorm:"primaryKey" json:"id"`

	Address string `gorm:"size:16;not null;uniqueIndex:idx_meteo_ds18b20_time,priority:1" json:"address"`

	TemperatureC *float64 `json:"temperature_c"`

	MeasuredAt time.Time `gorm:"not null;uniqueIndex:idx_meteo_ds18b20_time,priority:2;index" json:"measured_at"`
}

func (MeteoDS18B20) TableName() string {
	return "meteo_ds18b20"
}

// получить температуру sensor_id=1 за последние сутки:
// var rows []models.MeteoDS18B20
// err := db.
// 	Where(
// 		"address = ? AND measured_at >= ?",
// 		"28FF641EC3103912",
// 		time.Now().Add(-24*time.Hour),
// 	).
// 	Order("measured_at ASC").
// 	Find(&rows).Error
