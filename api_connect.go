package main

import (
	"log"
	"strings"
	"unicode/utf8"

	"github.com/spf13/cast"
)

type ConnectHouse struct {
	ID    uint   `json:"id" gorm:"column:id"`
	House string `json:"house" gorm:"column:house"`
}

var connectPackages = map[string]string{
	"analog":  "Аналоговый пакет",
	"digital": "Цифровой пакет",
	"iptv":    "Интерактивное Smart TV",
}

func apiGuestSearchConnectHouses(ctx *ApiCtx) map[string]any {
	out := ctx.Out

	pack := strings.TrimSpace(ctx.D["package"])
	search := strings.TrimSpace(ctx.D["search"])

	if _, ok := connectPackages[pack]; !ok {
		out["status"] = "NOK"
		out["error"] = "Неизвестный пакет"
		return out
	}

	out["houses"] = []ConnectHouse{}

	if utf8.RuneCountInString(search) < 2 {
		return out
	}

	if utf8.RuneCountInString(search) > 100 {
		out["status"] = "NOK"
		out["error"] = "Слишком длинный запрос"
		return out
	}

	query := db.Table("master_doma").
		Select("id, house")

	if pack != "iptv" {
		query = query.Where("ktv = ?", 1)
	}

	// Поиск по части адреса.
	// Спецсимволы LIKE экранируем.
	search = strings.NewReplacer(
		"!", "!!",
		"%", "!%",
		"_", "!_",
	).Replace(search)

	query = query.Where(
		"house LIKE ? ESCAPE '!'",
		"%"+search+"%",
	)

	var houses []ConnectHouse

	if err := query.
		Order("house ASC").
		Limit(20).
		Scan(&houses).Error; err != nil {

		log.Println("Connect houses search error:", err)

		out["status"] = "NOK"
		out["error"] = "Ошибка поиска адресов"
		return out
	}

	out["houses"] = houses
	return out
}

func apiGuestSendConnectRequest(ctx *ApiCtx) map[string]any {
	out := ctx.Out

	pack := strings.TrimSpace(ctx.D["package"])
	houseID := cast.ToUint(ctx.D["house_id"])
	apartment := strings.TrimSpace(ctx.D["apartment"])
	phone := strings.TrimSpace(ctx.D["phone"])

	packageName, ok := connectPackages[pack]
	if !ok {
		out["status"] = "NOK"
		out["error"] = "Неизвестный пакет"
		return out
	}

	// Для Smart TV пока запрещаем отправку заявок.
	if pack == "iptv" {
		out["status"] = "NOK"
		out["error"] = "К сожалению, подключение по данному адресу недоступно!"
		return out
	}

	if houseID == 0 {
		out["status"] = "NOK"
		out["error"] = "Выберите адрес дома"
		return out
	}

	if apartment == "" || utf8.RuneCountInString(apartment) > 20 {
		out["status"] = "NOK"
		out["error"] = "Укажите корректный номер квартиры"
		return out
	}

	if phone == "" || utf8.RuneCountInString(phone) > 30 {
		out["status"] = "NOK"
		out["error"] = "Укажите номер телефона"
		return out
	}

	// Проверяем, что адрес существует и доступен
	// для выбранного пакета.
	var house ConnectHouse

	query := db.Table("master_doma").
		Select("id, house").
		Where("id = ?", houseID)

	if pack != "iptv" {
		query = query.Where("ktv = ?", 1)
	}

	result := query.Take(&house)

	if result.Error != nil {
		out["status"] = "NOK"
		out["error"] = "Адрес не найден или пакет недоступен"
		return out
	}

	// Пока только выводим в консоль сервера.
	log.Printf(
		"[CONNECT REQUEST] package=%q house_id=%d house=%q apartment=%q phone=%q ip=%q",
		packageName,
		house.ID,
		house.House,
		apartment,
		phone,
		ctx.IP,
	)

	out["message"] = "Заявка успешно отправлена. Мы свяжемся с вами как можно скорее."
	return out
}

//  ██████╗ ██████╗
// ██╔═══██╗██╔══██╗
// ██║   ██║██████╔╝
// ██║▄▄ ██║██╔══██╗
// ╚██████╔╝██║  ██║
//  ╚══▀▀═╝ ╚═╝  ╚═╝

type ConnectQRResult struct {
	HouseID  uint   `json:"house_id"`
	House    string `json:"house"`
	Entrance uint8  `json:"entrance"`
	KTV      bool   `json:"ktv"`
}

func apiGuestResolveConnectBox(ctx *ApiCtx) map[string]any {
	out := ctx.Out

	code := strings.TrimSpace(ctx.D["box"])

	// QR-код — ровно 4 цифры, включая ведущий ноль.
	if len(code) != 4 {
		out["status"] = "NOK"
		out["error"] = "Некорректный QR-код"
		return out
	}

	for _, c := range code {
		if c < '0' || c > '9' {
			out["status"] = "NOK"
			out["error"] = "Некорректный QR-код"
			return out
		}
	}

	// Первая цифра служебная (0 или 9).
	if code[0] != '0' && code[0] != '9' {
		out["status"] = "NOK"
		out["error"] = "Некорректный QR-код"
		return out
	}

	type QRRow struct {
		HouseID  uint   `gorm:"column:house_id"`
		House    string `gorm:"column:house"`
		Entrance uint8  `gorm:"column:entrance"`
		KTV      bool   `gorm:"column:ktv"`
	}

	var rows []QRRow

	// Сопоставляем адрес QR с master_doma.
	// Ищем по последним трём символам.
	err := db.Table("master_qr AS qr").
		Select(`
			d.id AS house_id,
			d.house AS house,
			qr.entrance AS entrance,
			d.ktv AS ktv
		`).
		Joins(`
			JOIN master_doma AS d
				ON d.house = qr.address
		`).
		Where("RIGHT(qr.qrcode, 3) = ?", code[1:]).
		Order("qr.id ASC").
		Scan(&rows).Error

	if err != nil {
		log.Println("QR lookup error:", err)
		out["status"] = "NOK"
		out["error"] = "Ошибка поиска адреса"
		return out
	}

	if len(rows) == 0 {
		out["status"] = "NOK"
		out["error"] = "Адрес по QR-коду не найден"
		return out
	}

	// Если суффикс QR совпадает для нескольких
	// адресов, автоматически не выбираем дом.
	for _, row := range rows[1:] {
		if row.HouseID != rows[0].HouseID ||
			row.Entrance != rows[0].Entrance {
			out["status"] = "NOK"
			out["error"] = "QR-код неоднозначен"
			return out
		}
	}

	out["address"] = ConnectQRResult{
		HouseID:  rows[0].HouseID,
		House:    rows[0].House,
		Entrance: rows[0].Entrance,
		KTV:      rows[0].KTV,
	}

	return out
}
