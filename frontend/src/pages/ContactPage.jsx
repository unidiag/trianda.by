import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SendIcon from "@mui/icons-material/Send";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import CloseIcon from "@mui/icons-material/Close";

import { sendDataToServer } from "utils/functions";

const MAX_MESSAGE = 1000;
const FORM_STORAGE_KEY = "advert_form_data";

const loadSavedPhone = () => {
  try {
    const value = localStorage.getItem(
      FORM_STORAGE_KEY
    );

    if (!value) {
      return "";
    }

    const data = JSON.parse(value);

    return typeof data.phone === "string"
      ? data.phone.trim()
      : "";
  } catch {
    return "";
  }
};

const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const isValidPhone = (value) => {
  if (!/^[+\d\s()-]+$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");

  return digits.length >= 5 && digits.length <= 15;
};

const isValidContact = (value) => {
  const v = value.trim();

  if (!v) {
    return false;
  }

  return isValidEmail(v) || isValidPhone(v);
};

export default function ContactPage() {
  const [contact, setContact] = useState(
    () => loadSavedPhone()
  );
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [startedAt] = useState(() => Date.now());
  const [website, setWebsite] = useState("");

  const messageLength = Array.from(message).length;
  const remaining = MAX_MESSAGE - messageLength;

  const contactError =
    contact.trim() !== "" &&
    !isValidContact(contact);

  const handleMessageChange = (event) => {
    const value = event.target.value;

    setMessage(
      Array.from(value)
        .slice(0, MAX_MESSAGE)
        .join("")
    );

    setSuccess(false);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const contactValue = contact.trim();
    const messageValue = message.trim();

    if (
      !contactValue ||
      !messageValue ||
      !isValidContact(contactValue) ||
      sending
    ) {
      return;
    }

    setSending(true);
    setSuccess(false);
    setError("");

    try {
      const data = await sendDataToServer({
        op: "guestSendContact",
        contact: contactValue,
        message: messageValue,
        website,
        started_at: Math.floor(startedAt / 1000),
      });

      if (data?.status !== "OK" || !data?.sent) {
        setError(
          data?.error ||
            "Не удалось отправить сообщение"
        );

        return;
      }

      setContact("");
      setMessage("");
      setSuccess(true);
    } catch {
      setError("Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    isValidContact(contact) &&
    message.trim() !== "" &&
    !sending;

return (
  <Container
    maxWidth="sm"
    sx={{ py: { xs: 3, sm: 5 } }}
  >
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
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
          Обратная связь
        </Typography>


        <Alert
          severity="info"
          sx={{
            mb: 3,
            fontSize: "0.75rem",
            lineHeight: 1.45,
          }}
        >
          Обращаем Ваше внимание, что в соответствии с законодательством
          заключение и расторжение договора осуществляются только после
          подтверждения личности (по документу), а не по телефону, электронной почте или через форму
          обратной связи.
        </Alert>


        <Stack spacing={2}>
          <TextField
            label="Телефон или email"
            value={contact}
            onChange={(event) => {
              setContact(event.target.value);
              setSuccess(false);
              setError("");
            }}
            error={contactError}
            helperText={
              contactError
                ? "Введите корректный телефон или email"
                : " "
            }
            inputProps={{
              maxLength: 50,
            }}
            InputProps={{
              endAdornment: contact ? (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => {
                      setContact("");
                      setSuccess(false);
                      setError("");
                    }}
                    aria-label="Очистить"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            fullWidth
            disabled={sending}
          />

          <TextField
            label="Сообщение"
            value={message}
            onChange={handleMessageChange}
            multiline
            minRows={6}
            fullWidth
            disabled={sending}
            helperText={`Осталось символов: ${remaining}`}
            FormHelperTextProps={{
                sx: {
                    textAlign: "right",
                    mx: 0,
                },
            }}
          />

          <TextField
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            name="website"
            autoComplete="off"
            tabIndex={-1}
            sx={{
              position: "absolute",
              left: "-10000px",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          />

          {success && (
            <Alert severity="success">
              Сообщение отправлено
            </Alert>
          )}

          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          <Box>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canSend}
              startIcon={
                sending ? (
                  <CircularProgress
                    size={18}
                    color="inherit"
                  />
                ) : (
                  <SendIcon />
                )
              }
            >
              {sending
                ? "Отправка..."
                : "Отправить"}
            </Button>
          </Box>
        </Stack>
      </Box>
      </Paper>
    </Container>
  );
}