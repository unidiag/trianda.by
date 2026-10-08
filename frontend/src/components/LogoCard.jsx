import React, { useState } from "react";
import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";

export default function LogoCard({
  title,
  src,
  alt,
  downloadName,
}) {
  const [loading, setLoading] = useState(true);

  return (
    <Box>
      <Typography
        variant="h5"
        component="h2"
        sx={{
          fontWeight: 700,
          mb: 2,
          textAlign: "center",
          fontSize: {
            xs: "1.15rem",
            sm: "1.3rem",
          },
        }}
      >
        {title}
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box
          component="a"
          href={src}
          download={downloadName}
          sx={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: {
              xs: 220,
              sm: 260,
              md: 280,
            },
            height: 180,
            lineHeight: 0,
            cursor: "pointer",
          }}
        >
          {loading && (
            <CircularProgress
              size={36}
              sx={{
                position: "absolute",
              }}
            />
          )}

          <Box
            component="img"
            src={src}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              opacity: loading ? 0 : 1,
              transition: "opacity 0.3s ease",
            }}
          />
        </Box>
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 1,
          textAlign: "center",
        }}
      >
        Нажмите на логотип, чтобы скачать
      </Typography>
    </Box>
  );
}