import React, { useEffect, useState } from "react";

import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import PaymentIcon from "@mui/icons-material/Payment";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import QrPay from "components/QrPay";
import { useToast } from "utils/useToast";

export default function PayPage() {


  const getHashParams = () => {
    const hash = window.location.hash.replace(/^#/, "");

    const params = new URLSearchParams(
      hash
        .replace(/^adv&?/, "service=adv&")
        .replace(/^summ=/, "summ=")
    );

    return {
      service:
        hash === "adv" || hash.startsWith("adv&")
          ? "adv"
          : "subscription",

      summ: params.get("summ") || "",
    };
  };

  const initialHash = getHashParams();


  const [service, setService] = useState(initialHash.service);
  const [summ, setSumm] = useState(initialHash.summ);


  const toast = useToast();


  const copySumm = async () => {
    try {
      await navigator.clipboard.writeText(summ);

      toast.success(
        "Сумма скопирована в буфер",
        1000
      );
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  };

  const copyServiceCode = async () => {
    try {
      await navigator.clipboard.writeText(currentService.srv);

      toast.success(
        "Код услуги скопирован в буфер",
        1000
      );
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  };

  const services = {
    subscription: {
      name: "Абонентская плата ТВ",
      srv: "5123",
      hash: "",
    },

    adv: {
      name: "Реклама, объявления",
      srv: "187263",
      hash: "#adv",
    },
  };

  const currentService = services[service];

  const eripPath = [
    "Интернет, телевидение, телефония",
    "Прочие организации",
    "Витебская обл.",
    "Чашникский р-н",
    "ТриАнда",
    currentService.name,
  ];

  const changeService = (value) => {
    setService(value);

    const parts = [];

    if (value === "adv") {
      parts.push("adv");
    }

    if (summ) {
      parts.push(`summ=${encodeURIComponent(summ)}`);
    }

    const hash =
      parts.length > 0
        ? `#${parts.join("&")}`
        : "";

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${hash}`
    );
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");

      const isAdv =
        hash === "adv" ||
        hash.startsWith("adv&");

      setService(
        isAdv
          ? "adv"
          : "subscription"
      );

      const match = hash.match(
        /(?:^|&)summ=([^&]+)/
      );

      setSumm(
        match
          ? decodeURIComponent(match[1])
          : ""
      );
    };

    window.addEventListener(
      "hashchange",
      handleHashChange
    );

    return () => {
      window.removeEventListener(
        "hashchange",
        handleHashChange
      );
    };
  }, []);

  return (
    <Container
      maxWidth="md"
      sx={{
        py: {
          xs: 3,
          sm: 5,
        },
      }}
    >
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
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <PaymentIcon color="primary" />

          <Typography
            variant="h4"
            sx={{
              fontSize: {
                xs: "1.6rem",
                sm: "2rem",
              },
            }}
          >
            Как оплатить
          </Typography>
        </Box>

        <Typography
          variant="h6"
          sx={{
            mb: 1,
          }}
        >
          Способы оплаты
        </Typography>

        <List
          sx={{
            pl: {
              xs: 1,
              sm: 3,
            },
            mb: 3,
          }}
        >

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
              color: "success.main",
            }}
          >
            <ListItemText
              primary="в инфокиосках банков (без комиссии)"
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
              color: "success.main",
            }}
          >
            <ListItemText
              primary="через интернет-банкинг (ЕРИП) (без комиссии)"
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            
            <ListItemText
              primary={
                <>
                  в банках города{" "}
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    (самая низкая комиссия в
                    «Белагропромбанк»)
                  </Box>
                </>
              }
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            <ListItemText
              primary="в отделениях Белпочты (комиссия 1.98 руб. за один платёж)"
            />
          </ListItem>

        </List>

        <Alert
          severity="info"
          sx={{
            mb: 3,
          }}
        >
          Если оплачиваете с комиссией, можно оплатить сразу за несколько месяцев вперёд (коммиссия одна).
          Сумма переплаты будет зачислена нами в аванс (предоплата), а средства зачтутся в последующем.
        </Alert>



        {!summ && (
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={1}
            sx={{
              mb: 3,
            }}
          >
            <Button
              variant={
                service === "subscription"
                  ? "contained"
                  : "outlined"
              }
              onClick={() =>
                changeService("subscription")
              }
            >
              Абонентская плата
            </Button>

            <Button
              variant={
                service === "adv"
                  ? "contained"
                  : "outlined"
              }
              onClick={() => changeService("adv")}
            >
              Реклама
            </Button>
          </Stack>     
        )}

        <Box
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
            },
            mb: 3,
            borderRadius: 2,
            bgcolor: "action.hover",
          }}
        >
          <Typography
            sx={{
              mb: 1.5,
              fontWeight: 600,
            }}
          >
            Путь в системе ЕРИП
          </Typography>

          <Breadcrumbs
            separator={
              <NavigateNextIcon
                fontSize="small"
                color="action"
              />
            }
            sx={{
              "& .MuiBreadcrumbs-ol": {
                alignItems: "center",
              },

              "& .MuiBreadcrumbs-li": {
                mb: 0.5,
              },
            }}
          >
            {eripPath.map((item) => (
              <Chip
                key={item}
                label={item}
                size="small"
                variant="outlined"
              />
            ))}
          </Breadcrumbs>
        </Box>

        <Box
          sx={{
            p: 2,
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
            alignItems="center"
          >
            <QrPay
              srv={currentService.srv}
              size={160}
            />

            <Box
              sx={{
                flex: 1,
                textAlign: {
                  xs: "center",
                  sm: "left",
                },
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                Оплата через ЕРИП
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 1.5,
                }}
              >
                Отсканируйте QR-код камерой телефона
                или нажмите на него.<br />На следующей странице выберите приложение своего мобильного банка.
              </Typography>

              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                justifyContent={{
                  xs: "center",
                  sm: "flex-start",
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Код услуги:
                </Typography>

                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {currentService.srv}
                </Typography>

                <Tooltip title="Копировать">
                  <IconButton
                    size="small"
                    onClick={copyServiceCode}
                    sx={{
                      ml: 0.5,
                    }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

{summ && (
  <Stack
    direction="row"
    spacing={0.5}
    alignItems="center"
    justifyContent={{
      xs: "center",
      sm: "flex-start",
    }}
    sx={{
      mt: 0.5,
    }}
  >
    <Typography
      variant="body2"
      color="text.secondary"
    >
      Сумма к оплате:
    </Typography>

    <Typography
      variant="h5"
      sx={{
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      {summ}
    </Typography>

    <Tooltip title="Копировать">
      <IconButton
        size="small"
        onClick={copySumm}
        sx={{
          ml: 0.5,
        }}
      >
        <ContentCopyIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Stack>
)}

            </Box>
          </Stack>



        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 3,
          }}
        >
          Перед подтверждением платежа внимательно
          проверяйте введённые данные.
        </Typography>
      </Paper>
    </Container>
  );
}