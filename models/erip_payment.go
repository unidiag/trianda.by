package models

import (
	"time"

	"github.com/shopspring/decimal"
)

type EripPayment struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement"`
	CreatedAt time.Time `gorm:"not null;index"`

	// Исходный файл и номер записи в нём.
	FileName string `gorm:"size:50;not null;uniqueIndex:idx_erip_file_row"`
	RowNum   int    `gorm:"not null;uniqueIndex:idx_erip_file_row"`

	// Номер услуги: "1", "2" и т.д.
	Service string `gorm:"size:20;not null;index"`

	// Реквизиты плательщика.
	Account string `gorm:"size:255;index"`
	Name    string `gorm:"size:255"`
	Address string `gorm:"size:255"`
	Period  string `gorm:"size:50"`

	Amount      decimal.Decimal `gorm:"type:decimal(15,2);not null;default:0"`
	ExtraAmount decimal.Decimal `gorm:"type:decimal(15,2);not null;default:0"`

	// Дата и время совершения платежа.
	PaymentAt time.Time `gorm:"index;not null"`

	// Идентификаторы из полей 12 и 13.
	OperationID string `gorm:"size:50;index"`
	PaymentID   string `gorm:"size:50;index"`

	// Поля 14, 15 и 17.
	Channel string `gorm:"size:100"`
	Type    string `gorm:"size:20"`
	Code    string `gorm:"size:50"`

	// Исходная строка после декодирования Windows-1251.
	RawLine string `gorm:"type:text"`
}
