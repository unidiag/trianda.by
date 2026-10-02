package models

var AllModels = []any{
	&Setting{},
	&User{},
	&UserRefreshToken{},

	&MeteoSensor{},
	&MeteoDS18B20{},
	&MeteoSensorHourly{},
}
