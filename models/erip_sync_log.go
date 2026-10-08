package models

import "time"

type EripSyncLog struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement"`
	CreatedAt time.Time `gorm:"not null;index"`
	Connected bool      `gorm:"not null;default:false"`
	Found     int       `gorm:"not null;default:0"`
	Moved     int       `gorm:"not null;default:0"`
	Error     string    `gorm:"type:text"`
}
