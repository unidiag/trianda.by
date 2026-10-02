import {
  Box,
  Paper,
  Typography,
} from "@mui/material";

import { useEffect } from "react";


const DISCOUNTS_ENABLED = true;


const PREPOSITIONS = new Set([
  "без",
  "близ",
  "в",
  "во",
  "вместо",
  "вне",
  "для",
  "до",
  "за",
  "из",
  "из-за",
  "из-под",
  "к",
  "ко",
  "кроме",
  "меж",
  "между",
  "на",
  "над",
  "надо",
  "о",
  "об",
  "обо",
  "около",
  "от",
  "ото",
  "перед",
  "передо",
  "по",
  "под",
  "подо",
  "при",
  "про",
  "ради",
  "с",
  "со",
  "сквозь",
  "среди",
  "у",
  "через",
]);


function countWords(text) {
  const words =
    text
      .toLowerCase()
      .match(
        /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu
      ) || [];

  return words.filter((word) => {
    if (/\d/.test(word)) {
      return true;
    }

    if (PREPOSITIONS.has(word)) {
      return false;
    }

    if (word.length <= 2) {
      return false;
    }

    return true;
  }).length;
}


function getSubscriberDiscount() {
  if (!DISCOUNTS_ENABLED) {
    return {
      discount: 0,
      tarif: "",
    };
  }

  try {
    const value =
      localStorage.getItem(
        "checkSubscriber"
      );

    if (!value) {
      return {
        discount: 0,
        tarif: "",
      };
    }

    const data = JSON.parse(value);

    const tarif =
      (data.tarif || "").trim();

    const amount =
      Number(data.amount);

    if (!Number.isFinite(amount)) {
      return {
        discount: 0,
        tarif,
      };
    }

    if (
      tarif === "Аналоговый пакет" &&
      amount < 20
    ) {
      return {
        discount: 5,
        tarif,
      };
    }

    if (
      tarif === "Цифровой пакет" &&
      amount < 30
    ) {
      return {
        discount: 10,
        tarif,
      };
    }

    return {
      discount: 0,
      tarif,
    };
  } catch {
    return {
      discount: 0,
      tarif: "",
    };
  }
}


export default function OrderSummary({
  text,
  periodDays,
  periodLabel,
  cashless,
  onSummaryChange,
}) {
  const wordsCount =
    countWords(text);

  const pricePerWord =
    cashless ? 2.0 : 1.0;

  const basePrice =
    wordsCount *
    periodDays *
    pricePerWord;

  const wordsDiscount =
    DISCOUNTS_ENABLED &&
    wordsCount >= 10
      ? 10
      : 0;

  const periodDiscount =
    DISCOUNTS_ENABLED &&
    periodDays >= 10
      ? 10
      : 0;

  const subscriberInfo =
    getSubscriberDiscount();

  const subscriberDiscount =
    subscriberInfo.discount;

  const subscriberTarif =
    subscriberInfo.tarif;

  const discountPercent =
    wordsDiscount +
    periodDiscount +
    subscriberDiscount;

  const discountAmount =
    basePrice *
    discountPercent /
    100;

  const totalPrice =
    basePrice -
    discountAmount;


  useEffect(() => {
    if (!onSummaryChange) {
      return;
    }

    onSummaryChange([
      wordsCount,
      pricePerWord,
      totalPrice,
    ]);
  }, [
    wordsCount,
    pricePerWord,
    totalPrice,
    onSummaryChange,
  ]);


  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          mb: 0.5,
        }}
      >
        <Typography
          color="text.secondary"
        >
          Количество слов
        </Typography>

        <Typography
          fontWeight={600}
        >
          {wordsCount}
        </Typography>
      </Box>


      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          mb: 0.5,
        }}
      >
        <Typography
          color="text.secondary"
        >
          Период
        </Typography>

        <Typography
          fontWeight={600}
        >
          {periodDays} {periodLabel}
        </Typography>
      </Box>


      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          mb:
            discountPercent > 0
              ? 0.5
              : 1,
        }}
      >
        <Typography
          color="text.secondary"
        >
          Тариф
        </Typography>

        <Typography
          fontWeight={600}
        >
          {pricePerWord.toFixed(2)}{" "}
          руб./слово в сутки
        </Typography>
      </Box>


      {subscriberDiscount > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            mb: 0.5,
            gap: 2,
          }}
        >
          <Typography
            color="success.main"
          >
            Скидка для абонента
            {subscriberTarif && (
              <>
                {" "}
                ({subscriberTarif})
              </>
            )}
          </Typography>

          <Typography
            fontWeight={600}
            color="success.main"
            sx={{
              whiteSpace: "nowrap",
            }}
          >
            -{subscriberDiscount}%
          </Typography>
        </Box>
      )}


      {wordsDiscount > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            mb: 0.5,
            gap: 2,
          }}
        >
          <Typography
            color="success.main"
          >
            Скидка за объём от 10 слов
          </Typography>

          <Typography
            fontWeight={600}
            color="success.main"
            sx={{
              whiteSpace: "nowrap",
            }}
          >
            -{wordsDiscount}%
          </Typography>
        </Box>
      )}


      {periodDiscount > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            mb: 0.5,
            gap: 2,
          }}
        >
          <Typography
            color="success.main"
          >
            Скидка за период от 10 дней
          </Typography>

          <Typography
            fontWeight={600}
            color="success.main"
            sx={{
              whiteSpace: "nowrap",
            }}
          >
            -{periodDiscount}%
          </Typography>
        </Box>
      )}


      {discountPercent > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            mb: 1,
          }}
        >
          <Typography
            color="text.secondary"
          >
            Сумма скидки
          </Typography>

          <Typography
            fontWeight={600}
          >
            -{discountAmount.toFixed(2)}{" "}
            руб.
          </Typography>
        </Box>
      )}


      <Box
        sx={{
          borderTop: 1,
          borderColor: "divider",
          pt: 1.5,
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "baseline",
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
        >
          Итого
        </Typography>

        <Typography
          variant="h5"
          fontWeight={700}
          color="success.main"
        >
          {totalPrice.toFixed(2)} руб.
        </Typography>
      </Box>
    </Paper>
  );
}