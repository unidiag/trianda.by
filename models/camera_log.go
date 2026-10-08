package models

import "time"

type CameraArchiveLog struct {
	ID uint64 `gorm:"primaryKey"`

	// Камера: cam1, cam2...
	Camera string `gorm:"size:20;index;not null"`

	// Дата/время самого архивного чанка.
	ArchiveTime time.Time `gorm:"index;not null"`

	// Абонент.
	Personal string `gorm:"size:50;index;not null"`
	Surname  string `gorm:"size:100;not null"`

	// Клиент.
	IP        string `gorm:"size:64;index"`
	UserAgent string `gorm:"type:text"`

	// download / play
	Type string `gorm:"size:20;index;not null"`

	// Когда пользователь запустил действие.
	CreatedAt time.Time `gorm:"index;autoCreateTime"`
}
