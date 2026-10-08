
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { sendDataToServer } from "utils/functions";
import { useToast } from "utils/useToast";

const PACKAGES = [
  { value: "analog", label: "Аналоговый пакет" },
  { value: "digital", label: "Цифровой пакет" },
  { value: "iptv", label: "Интерактивное Smart TV" },
];

const PACKAGE_INFO = {
  analog: {
    description: "51 канал. Подходит для всех (даже старых кинескопных) телевизоров.",
    price: "10.50",
  },
  digital: {
    description:
      "87 каналов, в том числе информационный канал, городские камеры и сервис архива. Подходит для ЖК-телевизоров с поддержкой DVB-C.",
    price: "16.00",
  },
  iptv: {
    description:
      "87 каналов, в том числе информационный канал, городские камеры и сервис архива. Подходит для современных телевизоров с поддержкой SmartTV.",
    price: "9.99",
  },
};

const HASH_PACKAGES = {
  "#analog": "analog",
  "#digital": "digital",
  "#iptv": "iptv",
};

const PACKAGE_HASHES = {
  analog: "#analog",
  digital: "#digital",
  iptv: "#iptv",
};

const getPackageFromHash = () =>
  HASH_PACKAGES[window.location.hash.toLowerCase()] || "digital";

// --------------------------------------------------
// Форматирование телефона
// --------------------------------------------------

// Международный: +375 (29) 715-36-16
const formatInternational = (digits) => {
  const d = digits.startsWith("375")
    ? digits.slice(3, 12)
    : digits.slice(0, 9);

  let result = "+375";

  if (d.length > 0) result += ` (${d.slice(0, 2)}`;
  if (d.length >= 2) result += ")";
  if (d.length > 2) result += ` ${d.slice(2, 5)}`;
  if (d.length > 5) result += `-${d.slice(5, 7)}`;
  if (d.length > 7) result += `-${d.slice(7, 9)}`;

  return result;
};

// Национальный: 8 (029) 715-36-16
const formatNational = (digits) => {
  const d = digits.slice(1, 11);

  let result = "8";

  if (d.length > 0) result += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) result += ")";
  if (d.length > 3) result += ` ${d.slice(3, 6)}`;
  if (d.length > 6) result += `-${d.slice(6, 8)}`;
  if (d.length > 8) result += `-${d.slice(8, 10)}`;

  return result;
};

// Короткий городской: 5-10-45
const formatLocal = (digits) => {
  const d = digits.slice(0, 5);

  let result = d.slice(0, 1);

  if (d.length > 1) result += `-${d.slice(1, 3)}`;
  if (d.length > 3) result += `-${d.slice(3, 5)}`;

  return result;
};

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  if (value.trim().startsWith("+") || digits.startsWith("375")) {
    return formatInternational(digits);
  }

  // Национальный номер отличаем по префиксу 80.
  if (digits.startsWith("80")) {
    return formatNational(digits);
  }

  return formatLocal(digits);
};

const isValidPhone = (value) => {
  return (
    /^\+375 \(\d{2}\) \d{3}-\d{2}-\d{2}$/.test(value) ||
    /^8 \(0\d{2}\) \d{3}-\d{2}-\d{2}$/.test(value) ||
    /^\d-\d{2}-\d{2}$/.test(value)
  );
};

// --------------------------------------------------
// Компонент
// --------------------------------------------------

export default function ConnectPage() {
  const toast = useToast();

  const [pack, setPack] = useState(getPackageFromHash);

  const [house, setHouse] = useState(null);
  const [houseInput, setHouseInput] = useState("");
  const [houses, setHouses] = useState([]);
  const [housesLoading, setHousesLoading] = useState(false);
  const [houseSearchError, setHouseSearchError] = useState("");

  const [apartment, setApartment] = useState("");
  const [phone, setPhone] = useState("");

  const [sending, setSending] = useState(false);

  const searchRequestId = useRef(0);


    const [qrLoading, setQrLoading] = useState(false);
    const [qrEntrance, setQrEntrance] = useState(null);

    const qrInitialized = useRef(false);


  // --------------------------------------------------
  // Синхронизация пакета с URL
  // --------------------------------------------------

useEffect(() => {
  const handleHashChange = () => {
    const nextPack = getPackageFromHash();

    setPack((previous) => {
      if (previous !== nextPack) {
        return nextPack;
      }
      return previous;
    });

    // При переходе между пакетами выбранный
    // дом нужно сбросить.
  };

  window.addEventListener("hashchange", handleHashChange);

  return () => {
    window.removeEventListener("hashchange", handleHashChange);
  };
}, []);




const resetHouse = () => {
  setHouse(null);
  setHouseInput("");
  setHouses([]);
  setHouseSearchError("");
  setQrEntrance(null);
};





const changePackage = (event) => {
  const value = event.target.value;

  if (value === pack) return;

  resetHouse();
  setPack(value);

  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname +
      window.location.search +
      PACKAGE_HASHES[value]
  );
};







useEffect(() => {
  if (qrInitialized.current) return;
  qrInitialized.current = true;

  const params = new URLSearchParams(window.location.search);
  const box = params.get("box");

  if (box === null) return;

  let cancelled = false;

  const loadQR = async () => {
    setQrLoading(true);

    try {
      const data = await sendDataToServer({
        op: "guestResolveConnectBox",
        box,
      });

      if (cancelled) return;

      if (data?.status !== "OK" || !data?.address) {
        toast.error(
          data?.error || "Не удалось определить адрес по QR-коду"
        );
        return;
      }

      const address = data.address;

      const selectedHouse = {
        id: address.house_id,
        house: address.house,
      };

      // Для дома без КТВ выбираем IPTV.
      if (!address.ktv) {
        setPack("iptv");

        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname +
            window.location.search +
            "#iptv"
        );
      }

      setHouse(selectedHouse);
      setHouseInput(address.house);
      setHouses([selectedHouse]);
      setHouseSearchError("");
      setQrEntrance(address.entrance);

      toast.success("Адрес определён по QR-коду");
    } catch (err) {
      if (!cancelled) {
        toast.error(
          err?.message || "Ошибка определения адреса"
        );
      }
    } finally {
      if (!cancelled) {
        setQrLoading(false);
      }
    }
  };

  loadQR();

  return () => {
    cancelled = true;
  };
}, [toast]);





  // --------------------------------------------------
  // AJAX-поиск адресов
  // --------------------------------------------------

  useEffect(() => {
    const requestId = ++searchRequestId.current;
    let cancelled = false;

    const search = houseInput.trim();

    if (house || search.length < 2) {
      setHouses([]);
      setHousesLoading(false);
      setHouseSearchError("");
      return;
    }

    setHouses([]);
    setHousesLoading(true);
    setHouseSearchError("");

    const timer = setTimeout(async () => {
      try {
        const data = await sendDataToServer({
          op: "guestSearchConnectHouses",
          package: pack,
          search,
        });

        if (
          cancelled ||
          requestId !== searchRequestId.current
        ) {
          return;
        }

        if (data?.status !== "OK") {
          throw new Error(
            data?.error || "Ошибка поиска адресов"
          );
        }

        setHouses(data.houses || []);
      } catch (err) {
        if (
          cancelled ||
          requestId !== searchRequestId.current
        ) {
          return;
        }

        setHouses([]);
        setHouseSearchError(
          err?.message || "Ошибка поиска адресов"
        );
      } finally {
        if (
          !cancelled &&
          requestId === searchRequestId.current
        ) {
          setHousesLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pack, houseInput, house]);

  // --------------------------------------------------
  // Проверка формы
  // --------------------------------------------------

  const validApartment = /^\d{1,3}$/.test(apartment);
  const validPhone = isValidPhone(phone);

  const canSubmit =
    house !== null &&
    validApartment &&
    validPhone &&
    !sending;

  // --------------------------------------------------
  // Отправка заявки
  // --------------------------------------------------

  const submit = async (event) => {
    event.preventDefault();

    if (sending) return;

    if (!house || !validApartment || !validPhone) {
      toast.info("Заполните адрес, квартиру и номер телефона");
      return;
    }

    setSending(true);

    try {
      const data = await sendDataToServer({
        op: "guestSendConnectRequest",
        package: pack,
        house_id: String(house.id),
        apartment: apartment.trim(),
        phone: phone.trim(),
      });

      if (data?.status !== "OK") {
        toast.error(
          data?.error || "Не удалось отправить заявку"
        );
        return;
      }

      toast.success(
        data.message || "Заявка успешно отправлена"
      );

      // Очищаем форму после успешной отправки.
      setHouse(null);
      setHouseInput("");
      setHouses([]);
      setHouseSearchError("");
      setApartment("");
      setPhone("");
    } catch (err) {
      toast.error(
        err?.message || "Ошибка соединения с сервером"
      );
    } finally {
      setSending(false);
    }
  };

  // --------------------------------------------------
  // Интерфейс
  // --------------------------------------------------

    return (
    <Box sx={{ py: { xs: 3, sm: 5 } }}>
        <Paper
        elevation={0}
        sx={{
            maxWidth: 600,
            mx: "auto",
            p: { xs: 2, sm: 3 },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
        }}
        >
        <Typography variant="h5" fontWeight={700} mb={1}>
          Заявка на подключение
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          mb={3}
        >
          Заполните форму для подключения телевидения от ООО «ТриАнда».
        </Typography>

        <Box component="form" onSubmit={submit}>
          <Stack spacing={3}>
            {/* Выбор пакета */}

            <FormControl>
              <FormLabel>Выберите пакет</FormLabel>

              <RadioGroup
                value={pack}
                onChange={changePackage}
              >
                {PACKAGES.map((item) => (
                  <FormControlLabel
                    key={item.value}
                    value={item.value}
                    control={<Radio />}
                    label={item.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>






            {/* Информация о выбранном пакете */}

            <Alert severity="info" sx={{ fontSize: "0.875rem" }}>
              {PACKAGE_INFO[pack].description}
              {" "}
              <Box component="span" sx={{ fontWeight: 700 }}>
                Стоимость: {PACKAGE_INFO[pack].price} руб/мес
              </Box>
            </Alert>







            {/* Адрес дома */}

            <Autocomplete
                options={
                house && !houses.some((item) => item.id === house.id)
                    ? [house, ...houses]
                    : houses
                }
              value={house}
              disabled={qrLoading}
              inputValue={houseInput}
              loading={housesLoading}
              filterOptions={(options) => options}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={(option) => option.house || ""}
              noOptionsText={
                houseInput.trim().length < 2
                  ? "Введите минимум 2 символа"
                  : "Адреса не найдены"
              }
              loadingText="Поиск адресов..."
              onChange={(_, value) => {
                setHouse(value);
                setHouseSearchError("");
              }}
              onInputChange={(_, value, reason) => {
                if (reason === "input") {
                  setHouse(null);
                  setHouseInput(value);
                } else if (reason === "clear") {
                  setHouse(null);
                  setHouseInput("");
                } else if (reason === "reset") {
                  setHouseInput(value);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Адрес дома"
                  required
                  placeholder="Начните вводить адрес"
                  error={Boolean(houseSearchError)}
                  helperText={houseSearchError}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {housesLoading && (
                          <CircularProgress
                            size={18}
                            color="inherit"
                          />
                        )}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />





            {qrEntrance !== null && (
            <Typography variant="body2" color="text.secondary">
                Адрес определён по QR-коду.
                {qrEntrance > 0 && ` Подъезд №${qrEntrance}.`}
            </Typography>
            )}





            {/* Квартира */}

            <TextField
              label="Квартира"
              value={apartment}
              onChange={(event) => {
                const value = event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 3);

                setApartment(value);
              }}
              required
              inputProps={{
                maxLength: 3,
                inputMode: "numeric",
                pattern: "[0-9]{1,3}",
              }}
            />

            {/* Телефон */}

            <TextField
              label="Номер телефона"
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(formatPhone(event.target.value));
              }}
              placeholder="+375 (29) XXX-XX-XX"
              required
              error={phone.length > 0 && !validPhone}
              helperText={
                phone.length > 0 && !validPhone
                  ? "Введите полный мобильный или короткий городской номер"
                  : "Например: +375 (29) XXX-XX-XX, 8 (029) XXX-XX-XX или 5-XX-XX"
              }
              inputProps={{
                maxLength: 22,
                autoComplete: "tel",
              }}
            />

            {/* Отправка */}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canSubmit}
              sx={{ py: 1.5 }}
            >
              {sending ? (
                <CircularProgress
                  size={24}
                  color="inherit"
                />
              ) : (
                "Отправить заявку"
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
