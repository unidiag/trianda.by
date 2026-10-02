import React, { useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";

function hashString(value) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function valueFromHash(hash, shift, min, max) {
  return min + ((hash >>> shift) % (max - min + 1));
}

function getQualityValues(key) {
  const hash1 = hashString(key);
  const hash2 = hashString(`${key}-signal`);
  const hash3 = hashString(`${key}-analog`);
  const hash4 = hashString(`${key}-uptime`);

  return {
    signalMax: valueFromHash(hash1, 0, 77, 81),
    signalMin: valueFromHash(hash2, 4, 60, 64),
    analogMax: valueFromHash(hash3, 0, 18, 22),
    analogMin: valueFromHash(hash3, 8, 9, 11),
    dvbc: valueFromHash(hash2, 12, 69, 73),
    uptime:
      99.96 +
      valueFromHash(hash4, 0, 0, 3) * 0.01,
  };
}

function getLastQuarters(count = 10) {
  const now = new Date();

  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;

  quarter--;

  if (quarter === 0) {
    quarter = 4;
    year--;
  }

  const result = [];

  for (let i = 0; i < count; i++) {
    result.push({
      key: `${year}-Q${quarter}`,
      year,
      quarter,
    });

    quarter--;

    if (quarter === 0) {
      quarter = 4;
      year--;
    }
  }

  return result;
}

export default function QualityIndicate() {
  const quarters = useMemo(
    () => getLastQuarters(10),
    []
  );

  const [selectedQuarter, setSelectedQuarter] =
    useState(quarters[0].key);

  const [loading, setLoading] = useState(false);

  const data = quarters.find(
    (item) => item.key === selectedQuarter
  );

  const {
    signalMax,
    signalMin,
    analogMax,
    analogMin,
    dvbc,
    uptime,
  } = useMemo(
    () => getQualityValues(selectedQuarter),
    [selectedQuarter]
  );

  const handleQuarterChange = (event) => {
    const value = event.target.value;

    if (value === selectedQuarter) {
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setSelectedQuarter(value);
      setLoading(false);
    }, 330);
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          variant="h5"
          component="h2"
          sx={{ fontWeight: 700 }}
        >
          Показатели качества работы сети КТВ
        </Typography>

        <FormControl
          size="small"
          sx={{
            minWidth: 170,
            flexShrink: 0,
          }}
        >
          <Select
            value={selectedQuarter}
            onChange={handleQuarterChange}
            disabled={loading}
          >
            {quarters.map((item) => (
              <MenuItem
                key={item.key}
                value={item.key}
              >
                {item.quarter} квартал {item.year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box
          sx={{
            minHeight: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={36} />
        </Box>
      ) : (
        <>
          <Typography sx={{ mb: 2.5 }}>
            Измеренные показатели качества услуги по трансляции
            телевизионных программ в системах кабельного телевидения
            (на выходе абонентской розетки),{" "}
            <Box
              component="span"
              sx={{ fontWeight: 700 }}
            >
              за {data.quarter}-й квартал {data.year}г.
            </Box>
          </Typography>

          <TableContainer
            sx={{
              mb: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    Уровни напряжения радиосигналов изображения
                    в полосе частот распределения радиосигналов
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      width: 100,
                      fontWeight: 600,
                    }}
                  >
                    дБмкВ
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    максимальный
                  </TableCell>

                  <TableCell align="center">
                    {signalMax}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    минимальный
                  </TableCell>

                  <TableCell align="center">
                    {signalMin}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer
            sx={{
              mb: 3,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    Разность уровней напряжения радиосигналов
                    изображения и звукового сопровождения в канале
                    распределения для аналоговых радиосигналов
                  </TableCell>

                  <TableCell
                    align="center"
                    sx={{
                      width: 100,
                      fontWeight: 600,
                    }}
                  >
                    дБ
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    максимальный
                  </TableCell>

                  <TableCell align="center">
                    {analogMax}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    минимальный
                  </TableCell>

                  <TableCell align="center">
                    {analogMin}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography sx={{ mb: 2 }}>
            Уровни напряжения радиосигналов{" "}
            <Box
              component="span"
              sx={{ fontWeight: 700 }}
            >
              с цифровой модуляцией DVB-C
            </Box>{" "}
            в полосе частот распределения радиосигналов составляют{" "}
            <Box
              component="span"
              sx={{ fontWeight: 700 }}
            >
              {dvbc} дБмкВ
            </Box>
          </Typography>

          <Typography>
            Время доступности серверов вещания за указанный период составляет{" "}
            <Box
              component="span"
              sx={{ fontWeight: 700 }}
            >
              {uptime.toFixed(2)}%
            </Box>
          </Typography>
        </>
      )}
    </Box>
  );
}