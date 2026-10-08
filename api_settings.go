package main

import (
	"main/models"
	"os"
	"strings"
	"time"
)

func apiGetSettings(ctx *ApiCtx) map[string]any {
	out := ctx.Out

	var rows []models.Setting
	if err := db.
		Order("position ASC").
		Find(&rows).Error; err != nil {
		out["status"] = err.Error()
		return out
	}

	out["rows"] = rows
	return out
}

func apiSaveSetting(ctx *ApiCtx) map[string]any {
	out := ctx.Out
	d := ctx.D

	oldKey := strings.TrimSpace(d["old_key"])
	key := strings.TrimSpace(d["key"])
	value := d["value"]

	if key == "" {
		out["status"] = "empty key"
		return out
	}

	if oldKey == "" || oldKey == key {

		if err := db.
			Model(&models.Setting{}).
			Where("key = ?", key).
			Updates(map[string]any{
				"value": value,
			}).Error; err != nil {

			out["status"] = err.Error()
			return out
		}

		var row models.Setting
		db.First(&row, "key = ?", key)

		out["row"] = row
		return out
	}

	var row models.Setting
	if err := db.First(&row, "key = ?", oldKey).Error; err != nil {
		out["status"] = err.Error()
		return out
	}

	if err := db.Delete(&models.Setting{}, "key = ?", oldKey).Error; err != nil {
		out["status"] = err.Error()
		return out
	}

	row = models.Setting{
		Key:   key,
		Value: value,
	}

	if err := db.Create(&row).Error; err != nil {
		out["status"] = err.Error()
		return out
	}

	out["row"] = row
	return out
}

func apiRestartProgram(ctx *ApiCtx) map[string]any {
	out := ctx.Out

	go func() {
		time.Sleep(1000 * time.Millisecond)
		os.Exit(0)
	}()

	out["status"] = "OK"
	return out
}
