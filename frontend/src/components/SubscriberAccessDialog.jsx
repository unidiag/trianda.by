import React, { useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";

import { sendDataToServer } from "utils/functions";



export const SUBSCRIBER_STORAGE_KEY =
  "checkSubscriber";


export function loadSubscriberAccess() {
  try {
    const value =
      localStorage.getItem(
        SUBSCRIBER_STORAGE_KEY
      );

    if (!value) {
      return null;
    }

    const data =
      JSON.parse(value);

    return {
      personal:
        data.personal || "",

      surname:
        data.surname || "",

      tarif:
        data.tarif || "",

      amount:
        Number(data.amount) || 0,
    };
  } catch {
    return null;
  }
}


export function subscriberHasArchiveAccess(
  subscriber
) {
  if (!subscriber) {
    return false;
  }

  return (
    subscriber.tarif ===
      "Цифровой пакет" &&
    Number(subscriber.amount) <= 30
  );
}


export default function SubscriberAccessDialog({
  open,
  onClose,
  onSuccess,
}) {
  const [personal, setPersonal] =
    useState("");

  const [surname, setSurname] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");


  const handleClose = () => {
    if (loading) {
      return;
    }

    setError("");
    onClose();
  };


  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const personalValue =
      personal.trim();

    const surnameValue =
      surname.trim();

    if (
      !personalValue ||
      !surnameValue ||
      loading
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data =
        await sendDataToServer({
          op: "guestCheckBalance",
          personal:
            personalValue,
          surname:
            surnameValue,
        });

      if (!data) {
        setError(
          "Не удалось выполнить проверку"
        );
        return;
      }

      if (
        data.status !== "OK"
      ) {
        setError(
          data.error ||
            "Не удалось выполнить проверку"
        );
        return;
      }

      if (!data.found) {
        setError(
          "Лицевой счёт или фамилия указаны неверно"
        );
        return;
      }

      const subscriber = {
        personal:
          personalValue,

        surname:
          surnameValue,

        tarif:
          data.tarif || "",

        amount:
          Number(data.amount) || 0,
      };

      localStorage.setItem(
        SUBSCRIBER_STORAGE_KEY,
        JSON.stringify(
          subscriber
        )
      );

      if (
        !subscriberHasArchiveAccess(
          subscriber
        )
      ) {
        if (
          subscriber.tarif !==
          "Цифровой пакет"
        ) {
          setError(
            "Сервис архива камер доступен только абонентам цифрового пакета"
          );
          return;
        }

        if (
          subscriber.amount > 30
        ) {
          setError(
            "Для доступа к архиву камер задолженность не должна превышать 30 рублей"
          );
          return;
        }

        setError(
          "Доступ к архиву камер недоступен"
        );
        return;
      }

      onSuccess(
        subscriber
      );

      setError("");
      onClose();
    } catch (e) {
      console.error(e);

      setError(
        "Не удалось выполнить проверку"
      );
    } finally {
      setLoading(false);
    }
  };


  const canSubmit =
    personal.trim() !== "" &&
    surname.trim() !== "" &&
    !loading;


  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Доступ к архиву камер
      </DialogTitle>

      <DialogContent>
        <Alert
        severity="info"
        sx={{
            mb: 3,
        }}
        >
        Сервис архива камер только для абонентов цифрового пакета без задолженности
        </Alert>

        <Box
          component="form"
          id="subscriber-access-form"
          onSubmit={
            handleSubmit
          }
        >
          <Stack spacing={2}>
            <TextField
              label="Лицевой счёт"
              value={personal}
              onChange={(
                event
              ) => {
                setPersonal(
                  event.target.value
                );

                setError("");
              }}
              disabled={
                loading
              }
              autoComplete="off"
              fullWidth
            />

            <TextField
              label="Фамилия"
              value={surname}
              onChange={(
                event
              ) => {
                setSurname(
                  event.target.value
                );

                setError("");
              }}
              disabled={
                loading
              }
              autoComplete="family-name"
              fullWidth
            />

            {error && (
              <Alert
                severity="error"
              >
                {error}
              </Alert>
            )}
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={
            handleClose
          }
          disabled={
            loading
          }
        >
          Отмена
        </Button>

        <Button
          type="submit"
          form="subscriber-access-form"
          variant="contained"
          disabled={
            !canSubmit
          }
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
            ? "Подтверждение..."
            : "Подтвердить"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}