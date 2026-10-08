import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { useTheme } from "@mui/material/styles";

import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import SpeedIcon from "@mui/icons-material/Speed";

import { sendDataToServer } from "utils/functions";


const SENSORS = {
  outside: {
    value: "1",
    title: "Наружный датчик",
    temperature: true,
    humidity: true,
    pressure: true,
  },

  station: {
    value: "2",
    title: "Головная станция",
    temperature: true,
    humidity: true,
    pressure: true,
  },

  heating: {
    value: "28FF641EC3103912",
    title: "Отопление",
    temperature: true,
    humidity: false,
    pressure: false,
  },
};


const PERIODS = [
  {
    value: "hour",
    title: "Часовой",
  },
  {
    value: "day",
    title: "Суточный",
  },
  {
    value: "week",
    title: "Недельный",
  },
  {
    value: "month",
    title: "Месячный",
  },
  {
    value: "year",
    title: "Годовой",
  },
];


function formatTime(unix, period) {
  const date = new Date(unix * 1000);

  switch (period) {
    case "hour":
      return date.toLocaleTimeString(
        "ru-RU",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    case "day":
      return date.toLocaleTimeString(
        "ru-RU",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    case "week":
      return date.toLocaleDateString(
        "ru-RU",
        {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    case "month":
      return date.toLocaleDateString(
        "ru-RU",
        {
          day: "2-digit",
          month: "2-digit",
        }
      );

    case "year":
      return date.toLocaleDateString(
        "ru-RU",
        {
          day: "2-digit",
          month: "short",
        }
      );

    default:
      return "";
  }
}


function Chart({
  title,
  icon,
  data,
  field,
  suffix,
  digits = 1,
  period,
}) {
  const theme = useTheme();

  const values = useMemo(
    () =>
      data
        .filter(
          (item) =>
            item[field] !== null &&
            item[field] !== undefined
        )
        .map((item) => ({
          time: item.time,
          value: Number(item[field]),
        })),
    [
      data,
      field,
    ]
  );


  if (!values.length) {
    return null;
  }


  const width = 1000;
  const height = 280;

  const left = 64;
  const right = 20;
  const top = 25;
  const bottom = 48;

  const chartWidth =
    width -
    left -
    right;

  const chartHeight =
    height -
    top -
    bottom;


  let minValue = Math.min(
    ...values.map(
      (item) => item.value
    )
  );

  let maxValue = Math.max(
    ...values.map(
      (item) => item.value
    )
  );


  let delta =
    maxValue -
    minValue;

  if (delta === 0) {
    delta = 1;
  }


  const padding = delta * 0.08;

  minValue -= padding;
  maxValue += padding;


  const minTime =
    values[0].time;

  const maxTime =
    values[
      values.length - 1
    ].time;


  const timeDelta =
    Math.max(
      1,
      maxTime - minTime
    );


  const valueDelta =
    Math.max(
      0.0001,
      maxValue - minValue
    );


  const x = (time) =>
    left +
    (
      (time - minTime) /
      timeDelta
    ) *
      chartWidth;


  const y = (value) =>
    top +
    (
      1 -
      (
        value -
        minValue
      ) /
        valueDelta
    ) *
      chartHeight;


  const polyline = values
    .map(
      (item) =>
        `${x(item.time)},${y(
          item.value
        )}`
    )
    .join(" ");


  const horizontalLines =
    Array.from({
      length: 5,
    }).map(
      (_, index) => {
        const ratio =
          index / 4;

        return {
          y:
            top +
            ratio *
              chartHeight,

          value:
            maxValue -
            ratio *
              valueDelta,
        };
      }
    );


  const verticalLines =
    Array.from({
      length: 5,
    }).map(
      (_, index) => {
        const ratio =
          index / 4;

        const timestamp =
          minTime +
          ratio *
            timeDelta;

        return {
          x:
            left +
            ratio *
              chartWidth,

          timestamp,
        };
      }
    );


  const current =
    values[
      values.length - 1
    ].value;


  return (
    <Paper
      elevation={0}
      sx={{
        p: {
          xs: 1.5,
          sm: 2,
        },

        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: 2,
          mb: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {icon}

          <Typography
            variant="h6"
            sx={{
              fontSize: {
                xs: "1rem",
                sm: "1.1rem",
              },
            }}
          >
            {title}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontSize: {
              xs: "1.15rem",
              sm: "1.3rem",
            },
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {current.toFixed(
            digits
          )}
          {suffix}
        </Typography>
      </Box>


      <Box
        sx={{
          width: "100%",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
          }}
        >
          {horizontalLines.map(
            (line, index) => (
              <g
                key={`h-${index}`}
              >
                <line
                  x1={left}
                  x2={
                    width -
                    right
                  }
                  y1={line.y}
                  y2={line.y}
                  stroke={
                    theme.palette.divider
                  }
                  strokeWidth="1"
                />

                <text
                  x={
                    left -
                    8
                  }
                  y={
                    line.y +
                    4
                  }
                  textAnchor="end"
                  fontSize="13"
                  fill={
                    theme
                      .palette
                      .text
                      .secondary
                  }
                >
                  {line.value.toFixed(
                    digits
                  )}
                </text>
              </g>
            )
          )}


          {verticalLines.map(
            (line, index) => (
              <g
                key={`v-${index}`}
              >
                <line
                  x1={line.x}
                  x2={line.x}
                  y1={top}
                  y2={
                    height -
                    bottom
                  }
                  stroke={
                    theme.palette.divider
                  }
                  strokeWidth="1"
                />

                <text
                  x={line.x}
                  y={
                    height -
                    16
                  }
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === 4
                        ? "end"
                        : "middle"
                  }
                  fontSize="13"
                  fill={
                    theme
                      .palette
                      .text
                      .secondary
                  }
                >
                  {formatTime(
                    line.timestamp,
                    period
                  )}
                </text>
              </g>
            )
          )}


          <polyline
            points={polyline}
            fill="none"
            stroke={
              theme.palette.primary.main
            }
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />


          {values.length === 1 && (
            <circle
              cx={x(
                values[0].time
              )}
              cy={y(
                values[0].value
              )}
              r="4"
              fill={
                theme.palette.primary.main
              }
            />
          )}
        </svg>
      </Box>
    </Paper>
  );
}


export default function MeteoPage() {
  const [sensor, setSensor] =
    useState("1");

  const [period, setPeriod] =
    useState("day");

  const [data, setData] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const sensorConfig =
    Object.values(
      SENSORS
    ).find(
      (item) =>
        item.value === sensor
    );


  useEffect(() => {
    let active = true;


    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await sendDataToServer({
            op: "guestGetMeteoChart",
            sensor,
            period,
          });


        if (!active) {
          return;
        }


        if (
          !response ||
          response.status !==
            "OK"
        ) {
          setError(
            response?.error ||
              "Не удалось получить данные"
          );

          setData([]);

          return;
        }


        setData(
          Array.isArray(
            response.points
          )
            ? response.points
            : []
        );
      } catch {
        if (active) {
          setError(
            "Не удалось получить данные"
          );

          setData([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };


    load();


    return () => {
      active = false;
    };
  }, [
    sensor,
    period,
  ]);


  return (
    <Box
      sx={{
        py: {
          xs: 3,
          sm: 5,
        },
      }}
    >
      <Typography
        variant="h4"
        sx={{
          mb: 3,

          fontSize: {
            xs: "1.7rem",
            sm: "2rem",
          },
        }}
      >
        Метеодатчики
      </Typography>


      <Paper
        elevation={0}
        sx={{
          p: {
            xs: 1.5,
            sm: 2,
          },

          mb: 3,

          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          spacing={2}
        >
          <FormControl
            fullWidth
          >
            <InputLabel>
              Датчик
            </InputLabel>

            <Select
              value={sensor}
              label="Датчик"
              onChange={(
                event
              ) =>
                setSensor(
                  event.target.value
                )
              }
            >
              <MenuItem value="1">
                Наружный датчик
              </MenuItem>

              <MenuItem value="2">
                Головная станция
              </MenuItem>

              <MenuItem
                value="28FF641EC3103912"
              >
                Отопление
              </MenuItem>
            </Select>
          </FormControl>


          <FormControl
            fullWidth
          >
            <InputLabel>
              Интервал
            </InputLabel>

            <Select
              value={period}
              label="Интервал"
              onChange={(
                event
              ) =>
                setPeriod(
                  event.target.value
                )
              }
            >
              {PERIODS.map(
                (item) => (
                  <MenuItem
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.title}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>
        </Stack>
      </Paper>


      {loading && (
        <Box
          sx={{
            minHeight: 250,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
          }}
        >
          <CircularProgress />
        </Box>
      )}


      {!loading &&
        error && (
          <Alert
            severity="error"
            sx={{
              mb: 2,
            }}
          >
            {error}
          </Alert>
        )}


      {!loading &&
        !error &&
        data.length === 0 && (
          <Alert severity="info">
            За выбранный период
            данных нет.
          </Alert>
        )}


      {!loading &&
        !error &&
        data.length > 0 && (
          <Stack spacing={2}>
            {sensorConfig
              ?.temperature && (
              <Chart
                title="Температура"
                icon={
                  <ThermostatIcon />
                }
                data={data}
                field="temperature"
                suffix=" °C"
                digits={1}
                period={period}
              />
            )}


            {sensorConfig
              ?.humidity && (
              <Chart
                title="Влажность"
                icon={
                  <WaterDropIcon />
                }
                data={data}
                field="humidity"
                suffix=" %"
                digits={1}
                period={period}
              />
            )}


            {sensorConfig
              ?.pressure && (
              <Chart
                title="Давление"
                icon={
                  <SpeedIcon />
                }
                data={data}
                field="pressure"
                suffix=" мм рт. ст."
                digits={1}
                period={period}
              />
            )}
          </Stack>
        )}
    </Box>
  );
}