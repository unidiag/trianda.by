package main

import (
	"fmt"
	"main/models"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cast"
)

var checkBalanceSemaphore = make(chan struct{}, 3)

func apiGetTime(ctx *ApiCtx) map[string]any {
	out := ctx.Out
	out["time"] = time.Now().Format("2006-01-02 15:04:05")
	return out
}

func apiGuestGetStroka(ctx *ApiCtx) map[string]any {
	time.Sleep(250 * time.Millisecond)
	out := ctx.Out

	const pageSize = 10

	page := max(cast.ToInt(ctx.D["page"]), 1)

	mode := ctx.D["mode"]

	loc, _ := time.LoadLocation("Europe/Minsk")

	now := time.Now().In(loc)

	todayEnd := time.Date(
		now.Year(),
		now.Month(),
		now.Day(),
		23, 59, 59, 0,
		loc,
	)

	query := db.Model(&models.Stroka{}).
		Where("`delete` = 0").
		Where("sh_int = 1").
		Where("CAST(datestart AS UNSIGNED) <= ?", todayEnd.Unix())

	if ctx.D["commercial"] == "1" {
		query = query.Where(`
		CAST(
			REPLACE(
				REPLACE(
					COALESCE(NULLIF(TRIM(amount), ''), '0'),
					' ',
					''
				),
				',',
				'.'
			)
			AS DECIMAL(15,2)
		) >= 1
	`)
	}

	switch mode {

	case "text":
		text := strings.TrimSpace(ctx.D["text"])

		if len([]rune(text)) < 3 {
			out["items"] = []models.Stroka{}
			out["total"] = 0
			out["page"] = 1
			out["pages"] = 0
			return out
		}

		words := strings.Fields(text)

		for _, word := range words {
			search := "%" + word + "%"

			query = query.Where(`
			(name LIKE ? OR text LIKE ?)
		`,
				search,
				search,
			)
		}

	default:
		loc, _ := time.LoadLocation("Europe/Minsk")

		date := ctx.D["date"]
		day := time.Now().In(loc)

		if date != "" {
			if t, err := time.ParseInLocation("2006-01-02", date, loc); err == nil {
				day = t
			}
		}

		dayStart := time.Date(
			day.Year(),
			day.Month(),
			day.Day(),
			0, 0, 0, 0,
			loc,
		)

		dayEnd := dayStart.
			AddDate(0, 0, 1).
			Add(-time.Second)

		query = query.
			Where("CAST(datestart AS UNSIGNED) <= ?", dayEnd.Unix()).
			Where("CAST(dateend AS UNSIGNED) >= ?", dayStart.Unix())
	}

	var total int64

	if err := query.Count(&total).Error; err != nil {
		out["status"] = err.Error()
		return out
	}

	pages := int((total + pageSize - 1) / pageSize)

	if pages > 0 && page > pages {
		page = pages
	}

	var rows []models.Stroka

	err := query.
		Order("id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&rows).Error

	if err != nil {
		out["status"] = err.Error()
		return out
	}

	type StrokaItem struct {
		ID     uint   `json:"id"`
		Text   string `json:"text"`
		Period string `json:"period"`
		Beznal int    `json:"beznal"`
	}

	items := make([]StrokaItem, 0, len(rows))

	for _, row := range rows {
		if row.Text == nil {
			continue
		}

		start := formatStrokaDate(row.DateStart)
		end := formatStrokaDate(row.DateEnd)

		period := ""

		switch {
		case start != "" && end != "":
			period = start + " - " + end

		case start != "":
			period = start

		case end != "":
			period = end
		}

		items = append(items, StrokaItem{
			ID:     row.ID,
			Text:   *row.Text,
			Period: period,
			Beznal: row.Beznal,
		})
	}

	out["items"] = items
	out["total"] = total
	out["page"] = page
	out["pages"] = pages

	return out

}

func intPtr(v int) *int {
	return &v
}

func apiGuestAddStroka(ctx *ApiCtx) map[string]any {
	name := strings.TrimSpace(ctx.D["name"])
	phone := strings.TrimSpace(ctx.D["phone"])
	text := strings.TrimSpace(ctx.D["text"])
	dateStart := strings.TrimSpace(ctx.D["datestart"])
	dateEnd := strings.TrimSpace(ctx.D["dateend"])

	if name == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не указано имя"
		return ctx.Out
	}

	if phone == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не указан телефон"
		return ctx.Out
	}

	if text == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не указан текст объявления"
		return ctx.Out
	}

	startUnix, err := strconv.ParseInt(dateStart, 10, 64)
	if err != nil || startUnix <= 0 {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Некорректная дата начала"
		return ctx.Out
	}

	endUnix, err := strconv.ParseInt(dateEnd, 10, 64)
	if err != nil || endUnix <= 0 {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Некорректная дата окончания"
		return ctx.Out
	}

	if endUnix < startUnix {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Дата окончания меньше даты начала"
		return ctx.Out
	}

	whoAdd := "сайт"
	now := time.Now()
	dateAdd := now.Format("02.01.2006")
	telegram := 0

	amount := strings.TrimSpace(ctx.D["amount"])
	address := strings.TrimSpace(ctx.D["address"])
	if address == "" {
		address = "сайт"
	}

	beznal := 0
	if ctx.D["beznal"] == "1" {
		beznal = 1
	}

	stroka := models.Stroka{
		Name:      &name,
		Address:   &address,
		Phone:     &phone,
		Text:      &text,
		DateStart: &dateStart,
		DateEnd:   &dateEnd,
		Date:      &dateAdd,
		Amount:    &amount,

		WhoAdd:  &whoAdd,
		TimeAdd: &now,
		Beznal:  beznal,

		MyStr:    0,
		Deleted:  1,
		ShowTV:   1,
		ShowInt:  1,
		ShowPan:  1,
		Telegram: &telegram,
	}

	if err := db.Create(&stroka).Error; err != nil {
		slog("guestAddStroka DB error: "+err.Error(), "error")

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не удалось добавить объявление"

		return ctx.Out
	}

	ctx.Out["id"] = stroka.ID

	return ctx.Out
}

func apiGuestCheckBalance(
	ctx *ApiCtx,
) map[string]any {

	select {
	case checkBalanceSemaphore <- struct{}{}:
		defer func() {
			<-checkBalanceSemaphore
		}()

	default:
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Слишком много запросов. Повторите позже."

		return ctx.Out
	}

	time.Sleep(
		500 * time.Millisecond,
	)

	personal := strings.TrimSpace(
		ctx.D["personal"],
	)

	surname := strings.TrimSpace(
		ctx.D["surname"],
	)

	if personal == "" ||
		surname == "" {

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Укажите лицевой счёт и фамилию"

		return ctx.Out
	}

	if len([]rune(personal)) > 50 ||
		len([]rune(surname)) > 100 {

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Некорректные данные"

		return ctx.Out
	}

	subscriber, err :=
		checkSubscriber(
			personal,
			surname,
		)

	if err != nil {
		slog(
			"guestCheckBalance error: "+
				err.Error(),
			"error",
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] =
			"Ошибка проверки лицевого счёта"

		return ctx.Out
	}

	if !subscriber.Found {
		ctx.Out["found"] = false
		return ctx.Out
	}

	ctx.Out["found"] = true
	ctx.Out["amount"] =
		subscriber.Amount

	ctx.Out["snapshot"] =
		subscriber.Snapshot

	ctx.Out["tarif"] =
		subscriber.Tarif

	ctx.Out["address"] =
		subscriber.Address

	return ctx.Out
}

type SubscriberCheck struct {
	Found    bool
	Amount   float64
	Snapshot int64
	Tarif    string
	Address  string
}

func checkSubscriber(
	personal string,
	surname string,
) (*SubscriberCheck, error) {

	personal = strings.TrimSpace(personal)
	surname = strings.TrimSpace(surname)

	/*
		Сервисный аккаунт.
	*/
	if personal == "9999" &&
		strings.EqualFold(
			surname,
			"зелепуго",
		) {

		return &SubscriberCheck{
			Found:    true,
			Amount:   5,
			Snapshot: time.Now().Unix(),
			Tarif:    "Цифровой пакет",
			Address:  "Энергетиков-12-34",
		}, nil
	}

	// далее основная логика..

	if personal == "" || surname == "" {
		return &SubscriberCheck{
			Found: false,
		}, nil
	}

	if len([]rune(personal)) > 50 ||
		len([]rune(surname)) > 100 {

		return &SubscriberCheck{
			Found: false,
		}, nil
	}

	type SubscriberRow struct {
		Account string `gorm:"column:account"`
		Summ    string `gorm:"column:summ"`
		Address string `gorm:"column:address"`
		Tarif   string `gorm:"column:tarif"`
		Update  int64  `gorm:"column:update"`
	}

	var row SubscriberRow

	result := db.Raw(`
		SELECT
			COALESCE(account, '') AS account,
			COALESCE(summ, '0') AS summ,
			COALESCE(address, '') AS address,
			COALESCE(tarif, '') AS tarif,
			COALESCE(`+"`update`"+`, 0) AS `+"`update`"+`
		FROM master_database
		WHERE personal = ?
		ORDER BY `+"`update`"+` DESC
		LIMIT 1
	`, personal).Scan(&row)

	if result.Error != nil {
		return nil, result.Error
	}

	if result.RowsAffected == 0 {
		return &SubscriberCheck{
			Found: false,
		}, nil
	}

	accountParts := strings.Fields(
		row.Account,
	)

	if len(accountParts) == 0 ||
		!strings.EqualFold(
			accountParts[0],
			surname,
		) {

		return &SubscriberCheck{
			Found: false,
		}, nil
	}

	tarif := strings.TrimSpace(
		row.Tarif,
	)

	/*
		"Нет договора" считаем так же,
		как несуществующего абонента.
	*/
	if strings.EqualFold(
		tarif,
		"Нет договора",
	) {
		return &SubscriberCheck{
			Found: false,
		}, nil
	}

	summText := strings.TrimSpace(
		row.Summ,
	)

	summText = strings.ReplaceAll(
		summText,
		" ",
		"",
	)

	summText = strings.ReplaceAll(
		summText,
		",",
		".",
	)

	amount, err := strconv.ParseFloat(
		summText,
		64,
	)

	if err != nil {
		return nil, fmt.Errorf(
			"invalid subscriber summ %q: %w",
			row.Summ,
			err,
		)
	}

	/*
		Сохраняем твою текущую логику:
		большую переплату frontend
		показывает как отсутствие долга.
	*/
	if amount < -10 {
		amount = 0
	}

	return &SubscriberCheck{
		Found:    true,
		Amount:   amount,
		Snapshot: row.Update,
		Tarif:    tarif,
		Address: strings.TrimSpace(
			row.Address,
		),
	}, nil
}

// ███╗   ███╗███████╗████████╗███████╗ ██████╗  ██████╗██╗  ██╗ █████╗ ██████╗ ████████╗███████╗
// ████╗ ████║██╔════╝╚══██╔══╝██╔════╝██╔═══██╗██╔════╝██║  ██║██╔══██╗██╔══██╗╚══██╔══╝██╔════╝
// ██╔████╔██║█████╗     ██║   █████╗  ██║   ██║██║     ███████║███████║██████╔╝   ██║   ███████╗
// ██║╚██╔╝██║██╔══╝     ██║   ██╔══╝  ██║   ██║██║     ██╔══██║██╔══██║██╔══██╗   ██║   ╚════██║
// ██║ ╚═╝ ██║███████╗   ██║   ███████╗╚██████╔╝╚██████╗██║  ██║██║  ██║██║  ██║   ██║   ███████║
// ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝

type MeteoChartPoint struct {
	Time        int64    `json:"time"`
	Temperature *float64 `json:"temperature,omitempty"`
	Humidity    *float64 `json:"humidity,omitempty"`
	Pressure    *float64 `json:"pressure,omitempty"`
}

type MeteoChartDBRow struct {
	MeasuredAt      time.Time `gorm:"column:measured_at"`
	TemperatureC    *float64  `gorm:"column:temperature_c"`
	HumidityPercent *float64  `gorm:"column:humidity_percent"`
	PressureMMHg    *float64  `gorm:"column:pressure_mmhg"`
}

func apiGuestGetMeteoChart(c *ApiCtx) map[string]any {
	sensor := strings.TrimSpace(c.D["sensor"])
	period := strings.TrimSpace(c.D["period"])

	if sensor == "" {
		sensor = "1"
	}

	if period == "" {
		period = "day"
	}

	now := time.Now()

	var (
		from       time.Time
		bucketSecs int64
	)

	switch period {
	case "hour":
		from = now.Add(-time.Hour)

		// минутные данные
		bucketSecs = 60

	case "day":
		from = now.Add(-24 * time.Hour)

		// одна точка каждые 5 минут
		bucketSecs = 5 * 60

	case "week":
		from = now.AddDate(0, 0, -7)

		// одна точка каждые 30 минут
		bucketSecs = 30 * 60

	case "month":
		from = now.AddDate(0, -1, 0)

		// одна точка каждые 2 часа
		bucketSecs = 2 * 60 * 60

	case "year":
		from = now.AddDate(-1, 0, 0)

		// одна точка каждые 12 часов
		bucketSecs = 12 * 60 * 60

	default:
		c.Out["status"] = "NOK"
		c.Out["error"] = "Unknown period"

		return c.Out
	}

	var rows []MeteoChartDBRow

	switch sensor {
	case "1", "2":
		err := db.Raw(`
			SELECT
				FROM_UNIXTIME(
					FLOOR(
						UNIX_TIMESTAMP(measured_at) / ?
					) * ?
				) AS measured_at,

				AVG(temperature_c) AS temperature_c,
				AVG(humidity_percent) AS humidity_percent,
				AVG(pressure_mmhg) AS pressure_mmhg

			FROM meteo_sensors

			WHERE sensor_id = ?
			  AND measured_at >= ?
			  AND measured_at <= ?

			GROUP BY
				FLOOR(
					UNIX_TIMESTAMP(measured_at) / ?
				)

			ORDER BY measured_at
		`,
			bucketSecs,
			bucketSecs,
			sensor,
			from,
			now,
			bucketSecs,
		).Scan(&rows).Error

		if err != nil {
			slog(
				"Meteo API sensor error: "+
					err.Error(),
				"error",
			)

			c.Out["status"] = "NOK"
			c.Out["error"] = "Database error"

			return c.Out
		}

	case "28FF641EC3103912":
		err := db.Raw(`
			SELECT
				FROM_UNIXTIME(
					FLOOR(
						UNIX_TIMESTAMP(measured_at) / ?
					) * ?
				) AS measured_at,

				AVG(temperature_c) AS temperature_c,

				NULL AS humidity_percent,
				NULL AS pressure_mmhg

			FROM meteo_ds18b20

			WHERE address = ?
			  AND measured_at >= ?
			  AND measured_at <= ?

			GROUP BY
				FLOOR(
					UNIX_TIMESTAMP(measured_at) / ?
				)

			ORDER BY measured_at
		`,
			bucketSecs,
			bucketSecs,
			sensor,
			from,
			now,
			bucketSecs,
		).Scan(&rows).Error

		if err != nil {
			slog(
				"Meteo API DS18B20 error: "+
					err.Error(),
				"error",
			)

			c.Out["status"] = "NOK"
			c.Out["error"] = "Database error"

			return c.Out
		}

	default:
		c.Out["status"] = "NOK"
		c.Out["error"] = "Unknown sensor"

		return c.Out
	}

	points := make(
		[]MeteoChartPoint,
		0,
		len(rows),
	)

	for _, row := range rows {
		points = append(
			points,
			MeteoChartPoint{
				Time: row.MeasuredAt.Unix(),

				Temperature: row.TemperatureC,
				Humidity:    row.HumidityPercent,
				Pressure:    row.PressureMMHg,
			},
		)
	}

	c.Out["sensor"] = sensor
	c.Out["period"] = period

	c.Out["from"] = from.Unix()
	c.Out["to"] = now.Unix()

	c.Out["points"] = points

	return c.Out
}
