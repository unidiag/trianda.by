import { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { Link as RouterLink } from "react-router-dom";
import { sendDataToServer } from "utils/functions";


const STORAGE_KEY = "checkSubscriber";


const loadSubscriber = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return {
        personal: "",
        surname: "",
      };
    }

    const data = JSON.parse(value);

    return {
      personal: data.personal || "",
      surname: data.surname || "",
    };
  } catch {
    return {
      personal: "",
      surname: "",
    };
  }
};


const formatSnapshotDate = (unix) => {
  if (!unix) {
    return "";
  }

  const date = new Date(unix * 1000);

  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const datePart = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `${datePart} в ${time}`;
};


export default function CheckPage() {
  const [savedSubscriber] = useState(loadSubscriber);

  const [personal, setPersonal] = useState(
    savedSubscriber.personal
  );

  const [surname, setSurname] = useState(
    savedSubscriber.surname
  );

  const [loading, setLoading] = useState(false);

  const [amount, setAmount] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [tarif, setTarif] = useState("");
  const [address, setAddress] = useState("");

  const [error, setError] = useState("");
  const [personalInvalid, setPersonalInvalid] = useState(false);


  const clearResult = () => {
    setAmount(null);
    setSnapshot(null);
    setTarif("");
    setAddress("");
    setError("");
    setPersonalInvalid(false);
  };


  const personalHelper = (
    <>
      Узнать можно по тел.{" "}
      <Link
        href="tel:+375213368388"
        underline="hover"
      >
        6-83-88
      </Link>
    </>
  );


const checkBalance = async (
  personalValue,
  surnameValue,
  fromStorage = false
) => {
  personalValue = personalValue.trim();
  surnameValue = surnameValue.trim();

  if (
    !personalValue ||
    !surnameValue
  ) {
    return;
  }

  setLoading(true);
  clearResult();

  try {
    const data = await sendDataToServer({
      op: "guestCheckBalance",
      personal: personalValue,
      surname: surnameValue,
    });

    if (!data) {
      setError(
        "Не удалось выполнить проверку"
      );
      return;
    }

    if (data.status !== "OK") {
      setError(
        data.error ||
          "Не удалось выполнить проверку"
      );
      return;
    }

    if (!data.found) {
      if (fromStorage) {
        localStorage.removeItem(
          STORAGE_KEY
        );
      }

      setPersonalInvalid(true);

      setError(
        "Лицевой счёт или фамилия указаны неверно"
      );

      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        personal: personalValue,
        surname: surnameValue,
        tarif: data.tarif || "",
        amount: Number(data.amount) || 0,
      })
    );

    setPersonal(personalValue);
    setSurname(surnameValue);

    setAmount(
      Number(data.amount)
    );

    setSnapshot(
      data.snapshot
        ? Number(data.snapshot)
        : null
    );

    setTarif(
      data.tarif || ""
    );

    setAddress(
      data.address || ""
    );
  } catch {
    setError(
      "Не удалось выполнить проверку"
    );
  } finally {
    setLoading(false);
  }
};


useEffect(() => {
  const personalValue =
    savedSubscriber.personal.trim();

  const surnameValue =
    savedSubscriber.surname.trim();

  if (
    !personalValue ||
    !surnameValue
  ) {
    return;
  }

  checkBalance(
    personalValue,
    surnameValue,
    true
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    await checkBalance(
      personal,
      surname
    );
  };


  const canSubmit =
    personal.trim() !== "" &&
    surname.trim() !== "" &&
    !loading;


  const renderSubscriberInfo = () => {
    if (amount === null) {
      return null;
    }

    return (
      <Box
        sx={{
          px: 2,
          py: 1.5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        {snapshot && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb:
                address || tarif
                  ? 1
                  : 0,
            }}
          >
            По состоянию на{" "}
            <Box
              component="span"
              sx={{
                fontWeight: 600,
                color: "text.primary",
              }}
            >
              {formatSnapshotDate(snapshot)}
            </Box>
          </Typography>
        )}

        {address && (
          <Typography>
            <Box
              component="span"
              sx={{
                color: "text.secondary",
              }}
            >
              Адрес:{" "}
            </Box>

            {address}
          </Typography>
        )}

        {tarif && (
          <Typography>
            <Box
              component="span"
              sx={{
                color: "text.secondary",
              }}
            >
              Пакет:{" "}
            </Box>

            {tarif}
          </Typography>
        )}
      </Box>
    );
  };


  const renderBalance = () => {
    if (amount === null) {
      return null;
    }

    if (amount > 0) {
    return (
        <Alert
        severity="warning"
        icon={<AccountBalanceWalletIcon />}
        sx={{
            "& .MuiAlert-message": {
            width: "100%",
            },
        }}
        >
        <Typography variant="body2">
            Задолженность
        </Typography>

        <Typography
            variant="h5"
            sx={{
            mt: 0.5,
            fontWeight: 700,
            }}
        >
            {amount.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            })}{" "}
            руб.
        </Typography>

        <Typography
        variant="body2"
        sx={{
            mt: 1.5,
        }}
        >
        Информация{" "}
        <Link
            component={RouterLink}
            to="/pay"
            underline="hover"
        >
            как оплатить
        </Link>
        {". Справки по тел. "}
        <Link
            href="tel:+375213368388"
            underline="hover"
        >
            6-83-88
        </Link>
        {" "}(пн–пт с 8.00 до 17.00 обед 13-14)
        </Typography>
        </Alert>
    );
    }

    if (amount < 0) {
      return (
        <Alert
          severity="success"
          icon={<AccountBalanceWalletIcon />}
          sx={{
            "& .MuiAlert-message": {
              width: "100%",
            },
          }}
        >
          <Typography variant="body2">
            Переплата
          </Typography>

          <Typography
            variant="h5"
            sx={{
              mt: 0.5,
              fontWeight: 700,
            }}
          >
            {Math.abs(amount).toLocaleString(
              "ru-RU",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}{" "}
            руб.
          </Typography>
        </Alert>
      );
    }

    return (
      <Alert
        severity="success"
        icon={<AccountBalanceWalletIcon />}
      >
        <Typography
          sx={{
            fontWeight: 600,
          }}
        >
          Задолженности нет
        </Typography>
      </Alert>
    );
  };


  return (
    <Container
      maxWidth="sm"
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
          mb: 1,
          fontSize: {
            xs: "1.7rem",
            sm: "2rem",
          },
        }}
      >
        Проверка лицевого счёта
      </Typography>

      <Typography
        color="text.secondary"
        sx={{
          mb: 3,
        }}
      >
        Введите номер лицевого счёта
        и фамилию абонента.
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: {
            xs: 2,
            sm: 3,
          },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
        >
          <Stack spacing={2}>
            <TextField
              label="Лицевой счёт"
              value={personal}
              onChange={(event) => {
                setPersonal(event.target.value);
                clearResult();
              }}
              autoComplete="off"
              fullWidth
              disabled={loading}
              error={personalInvalid}
              helperText={
                !personal.trim() ||
                personalInvalid
                  ? personalHelper
                  : " "
              }
              inputProps={{
                  maxLength: 50,
              }}
            />

            <TextField
              label="Фамилия"
              value={surname}
              onChange={(event) => {
                setSurname(event.target.value);
                clearResult();
              }}
              autoComplete="family-name"
              fullWidth
              disabled={loading}
              inputProps={{
                  maxLength: 100,
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canSubmit}
              startIcon={
                loading ? (
                  <CircularProgress
                    size={18}
                    color="inherit"
                  />
                ) : (
                  <SearchIcon />
                )
              }
            >
              {loading
                ? "Проверка..."
                : "Проверить"}
            </Button>

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}

            {renderSubscriberInfo()}

            {renderBalance()}
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
