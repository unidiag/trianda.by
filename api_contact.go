package main

import (
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type contactRateEntry struct {
	Count int
	From  time.Time
}

var contactRate = struct {
	sync.Mutex
	Items map[string]contactRateEntry
}{
	Items: make(map[string]contactRateEntry),
}

func contactRateLimit(ip string) bool {
	const (
		window = 10 * time.Minute
		limit  = 3
	)

	now := time.Now()

	contactRate.Lock()
	defer contactRate.Unlock()

	entry := contactRate.Items[ip]

	if entry.From.IsZero() || now.Sub(entry.From) > window {
		contactRate.Items[ip] = contactRateEntry{
			Count: 1,
			From:  now,
		}

		return true
	}

	if entry.Count >= limit {
		return false
	}

	entry.Count++
	contactRate.Items[ip] = entry

	return true
}

func apiGuestSendContact(ctx *ApiCtx) map[string]any {
	contact := strings.TrimSpace(ctx.D["contact"])
	message := strings.TrimSpace(ctx.D["message"])

	if isContactSpam(ctx.R, ctx.D) {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не удалось отправить сообщение"
		return ctx.Out
	}

	ip := getClientIP(ctx.R)

	if !contactRateLimit(ip) {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Слишком много сообщений. Попробуйте позже"
		return ctx.Out
	}

	if contact == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Укажите телефон или email"
		return ctx.Out
	}

	if message == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Введите текст сообщения"
		return ctx.Out
	}

	if utf8.RuneCountInString(contact) > 200 {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Слишком длинный контакт"
		return ctx.Out
	}

	if utf8.RuneCountInString(message) > 1000 {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Сообщение не должно превышать 1000 символов"
		return ctx.Out
	}

	sender := strings.TrimSpace(config.App.Sender)
	if sender == "" {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Сервис отправки не настроен"
		return ctx.Out
	}

	if !strings.HasPrefix(sender, "http://") &&
		!strings.HasPrefix(sender, "https://") {
		sender = "http://" + sender
	}

	contactHTML := html.EscapeString(contact)
	messageHTML := html.EscapeString(message)

	messageHTML = strings.ReplaceAll(
		messageHTML,
		"\n",
		"<br>",
	)

	country := geoIP(ip)
	ipHTML := html.EscapeString(ip)
	countryHTML := html.EscapeString(country)

	userAgent := strings.TrimSpace(ctx.R.UserAgent())

	if userAgent == "" {
		userAgent = "-"
	}

	if utf8.RuneCountInString(userAgent) > 300 {
		userAgent = string([]rune(userAgent)[:300])
	}
	userAgentHTML := html.EscapeString(userAgent)

	form := url.Values{}
	form.Set(
		"subject",
		"Сообщение через форму обратной связи",
	)
	form.Set(
		"text",
		"<b>Контакт:</b> "+
			contactHTML+
			"<br><br>"+
			messageHTML+
			"<br><br>"+
			"---"+
			"<br>"+
			"<b>IP:</b> "+
			ipHTML+
			" ("+
			countryHTML+
			")"+
			"<br>"+
			"<b>User-Agent:</b> "+
			userAgentHTML,
	)

	req, err := http.NewRequest(
		http.MethodPost,
		sender,
		strings.NewReader(form.Encode()),
	)
	if err != nil {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Ошибка формирования запроса"
		return ctx.Out
	}

	req.Header.Set(
		"Content-Type",
		"application/x-www-form-urlencoded",
	)

	// Аналог:
	// curl -H 'Host: master2.trianda.by'
	req.Host = "master2.trianda.by"

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		slog("contact sender request failed: " + err.Error())

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Сервис отправки временно недоступен"
		return ctx.Out
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(
		io.LimitReader(resp.Body, 64*1024),
	)
	if err != nil {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Ошибка ответа сервиса отправки"
		return ctx.Out
	}

	var senderResponse struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}

	if err := json.Unmarshal(body, &senderResponse); err != nil {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Некорректный ответ сервиса отправки"
		return ctx.Out
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Слишком много сообщений. Попробуйте через минуту"
		return ctx.Out
	}

	if resp.StatusCode != http.StatusOK || !senderResponse.OK {
		slog(
			fmt.Sprintf(
				"contact sender error: status=%d error=%s",
				resp.StatusCode,
				senderResponse.Error,
			),
		)

		ctx.Out["status"] = "NOK"
		ctx.Out["error"] = "Не удалось отправить сообщение"
		return ctx.Out
	}

	ctx.Out["sent"] = true

	return ctx.Out
}

func isContactSpam(r *http.Request, d map[string]string) bool {
	if strings.TrimSpace(d["website"]) != "" {
		return true
	}

	startedAt, _ := strconv.ParseInt(d["started_at"], 10, 64)

	if startedAt > 0 {
		elapsed := time.Now().Unix() - startedAt

		if elapsed < 2 {
			return true
		}

		if elapsed > 3600 {
			return true
		}
	}

	message := strings.TrimSpace(d["message"])
	contact := strings.TrimSpace(d["contact"])

	if utf8.RuneCountInString(message) < 5 {
		return true
	}

	if utf8.RuneCountInString(contact) < 3 {
		return true
	}

	lower := strings.ToLower(message)

	linkCount :=
		strings.Count(lower, "http://") +
			strings.Count(lower, "https://") +
			strings.Count(lower, "www.")

	if linkCount > 2 {
		return true
	}

	return false
}
