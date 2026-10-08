package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"main/models"

	"github.com/shopspring/decimal"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// importERIPPayments импортирует платежи из локальных
// файлов .206.
//
// Каждый файл обрабатывается в отдельной транзакции.
// Повторные платежи не добавляются.
func importERIPPayments() {
	entries, err := os.ReadDir(eripLocalDir)
	if err != nil {
		slog("ERIP: import readdir: "+err.Error(), "error")
		return
	}

	totalAdded := 0
	totalSkipped := 0
	totalErrors := 0

	for _, entry := range entries {
		if !entry.Type().IsRegular() {
			continue
		}

		if !strings.EqualFold(
			filepath.Ext(entry.Name()),
			".206",
		) {
			continue
		}

		path := filepath.Join(eripLocalDir, entry.Name())

		added, skipped, err := importERIPPaymentFile(path)
		if err != nil {
			slog(
				fmt.Sprintf(
					"ERIP: import file %q: %v",
					entry.Name(),
					err,
				),
				"error",
			)

			totalErrors++
			continue
		}

		totalAdded += added
		totalSkipped += skipped

		// if debug && added > 0 {
		// 	slog(
		// 		fmt.Sprintf(
		// 			"ERIP: imported %q, added=%d skipped=%d",
		// 			entry.Name(),
		// 			added,
		// 			skipped,
		// 		),
		// 		"info",
		// 	)
		// }
	}

	if debug {
		slog(
			fmt.Sprintf(
				"ERIP: import complete, added=%d skipped=%d errors=%d",
				totalAdded,
				totalSkipped,
				totalErrors,
			),
			"info",
		)
	}
}

// importERIPPaymentFile читает один файл .206
// и сохраняет платежи в одной транзакции.
//
// Возвращает:
// added   - количество добавленных платежей;
// skipped - количество уже существующих платежей;
// err     - ошибка чтения, разбора или сохранения.
func importERIPPaymentFile(
	path string,
) (added int, skipped int, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	// Декодирование Windows-1251 -> UTF-8.
	reader := transform.NewReader(
		f,
		charmap.Windows1251.NewDecoder(),
	)

	scanner := bufio.NewScanner(reader)
	scanner.Buffer(
		make([]byte, 4096),
		2*1024*1024,
	)

	fileName := filepath.Base(path)

	var payments []models.EripPayment

	lineNum := 0

	for scanner.Scan() {
		lineNum++

		line := strings.TrimSpace(scanner.Text())

		// Первая строка — служебный заголовок.
		if lineNum == 1 {
			continue
		}

		// Пустые строки пропускаем.
		if line == "" {
			continue
		}

		payment, err := parseERIPPayment(
			fileName,
			line,
		)
		if err != nil {
			return 0, 0, fmt.Errorf(
				"line %d: %w",
				lineNum,
				err,
			)
		}

		payments = append(payments, payment)
	}

	if err := scanner.Err(); err != nil {
		return 0, 0, fmt.Errorf(
			"read file: %w",
			err,
		)
	}

	if lineNum == 0 {
		return 0, 0, errors.New("empty file")
	}

	if len(payments) == 0 {
		return 0, 0, nil
	}

	// Сохраняем весь файл одной транзакцией.
	err = db.Transaction(func(tx *gorm.DB) error {
		for i := range payments {
			payment := &payments[i]

			var count int64

			// Проверяем, есть ли уже такой платёж.
			if err := tx.Model(&models.EripPayment{}).
				Where(
					"file_name = ? AND row_num = ?",
					payment.FileName,
					payment.RowNum,
				).
				Count(&count).Error; err != nil {
				return err
			}

			if count > 0 {
				skipped++
				continue
			}

			// Платежа ещё нет — добавляем.
			result := tx.Clauses(
				clause.OnConflict{
					DoNothing: true,
				},
			).Create(payment)

			if result.Error != nil {
				return result.Error
			}

			if result.RowsAffected > 0 {
				added++
			} else {
				skipped++
			}
		}

		return nil
	})

	if err != nil {
		return 0, 0, fmt.Errorf(
			"database transaction: %w",
			err,
		)
	}

	return added, skipped, nil

}

// parseERIPPayment разбирает одну строку файла .206.
//
// Формат:
// 1  - номер строки
// 2  - номер услуги
// 3  - лицевой счёт / идентификатор плательщика
// 4  - имя
// 5  - адрес
// 6  - период
// 7  - сумма
// 8  - дополнительная сумма
// 9  - дата платежа
// 10 - дополнительное поле
// 11 - дополнительное поле
// 12 - идентификатор операции
// 13 - идентификатор платежа
// 14 - канал
// 15 - тип операции
// 16 - дополнительное поле
// 17 - код
// 18 - пустое завершающее поле
func parseERIPPayment(
	fileName string,
	line string,
) (models.EripPayment, error) {
	var payment models.EripPayment

	fields := strings.Split(line, "^")

	// Минимум 17 содержательных полей.
	if len(fields) < 17 {
		return payment, fmt.Errorf(
			"invalid field count: %d",
			len(fields),
		)
	}

	rowNum, err := strconv.Atoi(
		strings.TrimSpace(fields[0]),
	)
	if err != nil || rowNum <= 0 {
		return payment, fmt.Errorf(
			"invalid row number: %q",
			fields[0],
		)
	}

	service := strings.TrimSpace(fields[1])
	if service == "" {
		return payment, errors.New("empty service")
	}

	amount, err := parseERIPAmount(fields[6])
	if err != nil {
		return payment, fmt.Errorf(
			"amount: %w",
			err,
		)
	}

	extraAmount, err := parseERIPAmount(fields[7])
	if err != nil {
		return payment, fmt.Errorf(
			"extra amount: %w",
			err,
		)
	}

	// Дата YYYYMMDDHHMMSS.
	paymentAt, err := time.ParseInLocation(
		"20060102150405",
		strings.TrimSpace(fields[8]),
		time.Local,
	)
	if err != nil {
		return payment, fmt.Errorf(
			"payment date %q: %w",
			fields[8],
			err,
		)
	}

	payment = models.EripPayment{
		FileName: fileName,
		RowNum:   rowNum,

		Service: service,

		Account: strings.TrimSpace(fields[2]),
		Name:    strings.TrimSpace(fields[3]),
		Address: strings.TrimSpace(fields[4]),
		Period:  strings.TrimSpace(fields[5]),

		Amount:      amount,
		ExtraAmount: extraAmount,
		PaymentAt:   paymentAt,

		OperationID: strings.TrimSpace(fields[11]),
		PaymentID:   strings.TrimSpace(fields[12]),

		Channel: strings.TrimSpace(fields[13]),
		Type:    strings.TrimSpace(fields[14]),
		Code:    strings.TrimSpace(fields[16]),

		RawLine: line,
	}

	return payment, nil
}

func parseERIPAmount(s string) (decimal.Decimal, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", ".")

	amount, err := decimal.NewFromString(s)
	if err != nil {
		return decimal.Zero, fmt.Errorf(
			"invalid amount %q: %w",
			s,
			err,
		)
	}

	// Не допускаем больше двух знаков после точки.
	if !amount.Equal(amount.Round(2)) {
		return decimal.Zero, fmt.Errorf(
			"amount has more than 2 decimal places: %q",
			s,
		)
	}

	return amount, nil
}
