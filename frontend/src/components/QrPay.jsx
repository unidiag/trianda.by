import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import { sendDataToServer } from "utils/functions";


const QrPay = ({ srv, size = 220 }) => {
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setImage("");
      setUrl("");
      setError("");

      try {
        const data = await sendDataToServer({
          op: "guestQrPay",
          srv,
        }); 

        if (!active) return;

        if (!data || data.status !== "OK") {
          setError(
            data?.error ||
            data?.status ||
            "Не удалось сформировать QR-код"
          );
          return;
        }

        setImage(data.image || "");
        setUrl(data.url || "");
      } catch (e) {
        if (!active) return;

        setError("Не удалось загрузить QR-код");
      }
    };

    if (srv) {
      load();
    }

    return () => {
      active = false;
    };
  }, [srv]);

  if (error) {
    return (
      <Typography
        variant="body2"
        color="error"
      >
        {error}
      </Typography>
    );
  }

  if (!image) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

    return (
    <Box
        component={url ? "a" : "div"}
        href={url || undefined}
        target={url ? "_blank" : undefined}
        rel={url ? "noopener noreferrer" : undefined}
        sx={{
        display: "inline-block",
        lineHeight: 0,
        cursor: url ? "pointer" : "default",

        "&:hover img": {
            borderColor: "primary.main",
        },
        }}
    >
        <Box
        component="img"
        src={image}
        alt="Оплата через ЕРИП"
        sx={{
            display: "block",
            width: size,
            height: size,
            maxWidth: "100%",
            borderRadius: "3px",

            border: "2px solid",
            borderColor: "divider",

            transition: "border-color 0.2s ease",
        }}
        />
    </Box>
    );
};

export default QrPay;