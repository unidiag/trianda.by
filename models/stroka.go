package models

import "time"

type Stroka struct {
	ID        uint       `gorm:"primaryKey;column:id" json:"id"`
	Name      *string    `gorm:"column:name;size:250" json:"name"`
	Address   *string    `gorm:"column:address;size:250" json:"address"`
	Phone     *string    `gorm:"column:phone;size:50" json:"phone"`
	Text      *string    `gorm:"column:text;type:text" json:"text"`
	DateStart *string    `gorm:"column:datestart;size:25" json:"datestart"`
	DateEnd   *string    `gorm:"column:dateend;size:25" json:"dateend"`
	Amount    *string    `gorm:"column:amount;size:250" json:"amount"`
	Date      *string    `gorm:"column:date;size:25" json:"date"`
	WhoAdd    *string    `gorm:"column:whoadd;type:text" json:"whoadd"`
	TimeAdd   *time.Time `gorm:"column:timeadd" json:"timeadd"`

	Beznal   int  `gorm:"column:beznal;default:0" json:"beznal"`
	MyStr    int  `gorm:"column:mystr;default:0" json:"mystr"`
	Deleted  int  `gorm:"column:delete;default:0" json:"delete"`
	ShowTV   int  `gorm:"column:sh_tv;default:1" json:"sh_tv"`
	ShowInt  int  `gorm:"column:sh_int;default:1" json:"sh_int"`
	ShowPan  int  `gorm:"column:sh_pan;default:0" json:"sh_pan"`
	Telegram *int `gorm:"column:telegram;default:0" json:"telegram"`
}

func (Stroka) TableName() string {
	return "trianda_stroka"
}
