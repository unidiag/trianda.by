package main

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

const qrPayUNP = "300015881"

func apiGuestQrPay(ctx *ApiCtx) map[string]any {
	srv := strings.TrimSpace(ctx.D["srv"])

	if srv == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не указан код услуги"
		return ctx.Out
	}

	// Разрешаем только цифры.
	for _, r := range srv {
		if r < '0' || r > '9' {
			ctx.Out["status"] = "NOK"
			ctx.Out["error"] = "Некорректный код услуги"
			return ctx.Out
		}
	}

	url := makeQrPayURL(srv, qrPayUNP)

	png, err := qrcode.Encode(
		url,
		qrcode.Medium,
		512,
	)
	if err != nil {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Ошибка генерации QR"
		return ctx.Out
	}

	ctx.Out["image"] = "data:image/png;base64," +
		base64.StdEncoding.EncodeToString(png)

	ctx.Out["url"] = url

	return ctx.Out
}

func makeQrPayURL(serviceCode, unp string) string {
	merchantData :=
		"0010by.raschet" +
			fmt.Sprintf("01%02d%s", len(serviceCode), serviceCode)

	payload :=
		"000201" +
			fmt.Sprintf("32%02d%s", len(merchantData), merchantData) +
			"52041111" +
			"5303933" +
			"5802BY" +
			fmt.Sprintf("59%02d%s", len("UNP_"+unp), "UNP_"+unp) +
			"6007Belarus"

	hash := sha256.Sum256([]byte(payload))

	checksum := strings.ToUpper(
		fmt.Sprintf("%x", hash)[60:],
	)

	payload += "6304" + checksum

	return "https://pay.raschet.by/#" + payload
}
