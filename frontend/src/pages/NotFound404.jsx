import React, { useEffect, useRef } from "react";
import { Box, Button, Typography } from "@mui/material";
import TvIcon from "@mui/icons-material/Tv";
import { Link } from "react-router-dom";

export default function NotFound404() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let frameId;
    let lastTime = 0;

    const renderNoise = (time) => {
      if (time - lastTime >= 45) {
        lastTime = time;

        const width = canvas.width;
        const height = canvas.height;

        const image = ctx.createImageData(width, height);
        const data = image.data;

        for (let i = 0; i < data.length; i += 4) {
          const value = Math.random() * 255;

          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
          data[i + 3] = 255;
        }

        ctx.putImageData(image, 0, 0);
      }

      frameId = requestAnimationFrame(renderNoise);
    };

    frameId = requestAnimationFrame(renderNoise);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
        <Box
        sx={{
            position: "relative",
            width: {
            xs: 320,
            sm: 460,
            md: 520,
            },
            aspectRatio: "1 / 1",
        }}
        >
        <TvIcon
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            color: "text.primary",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        <Box
        sx={{
            position: "absolute",

            left: "12.5%",
            top: "20.833%",
            width: "75%",
            height: "50%",

            overflow: "hidden",
            bgcolor: "#111",
            zIndex: 1,
        }}
        >
          <Box
            component="canvas"
            ref={canvasRef}
            width={220}
            height={130}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              imageRendering: "pixelated",
            }}
          />

          {/* scanlines */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,.15) 0px, rgba(0,0,0,.15) 1px, transparent 1px, transparent 3px)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />

          {/* небольшое затемнение */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0,0,0,.12)",
              zIndex: 2,
            }}
          />

          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 3,

              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",

              color: "#fff",
              textAlign: "center",
              textShadow: "0 1px 4px #000",
            }}
          >
            <Typography
              sx={{
                fontSize: {
                  xs: "3rem",
                  sm: "5rem",
                },
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: 4,
              }}
            >
              404
            </Typography>

            <Typography
              sx={{
                mt: 1,
                fontSize: {
                  xs: "0.85rem",
                  sm: "1.1rem",
                },
                fontWeight: 600,
                letterSpacing: 2,
              }}
            >
              НЕТ СИГНАЛА
            </Typography>

            <Typography
              sx={{
                mt: 0.5,
                fontSize: {
                  xs: "0.65rem",
                  sm: "0.8rem",
                },
              }}
            >
              Страница не найдена
            </Typography>
          </Box>
        </Box>

        <Button
          component={Link}
          to="/"
          variant="contained"
          size="small"
          sx={{
            position: "absolute",
            left: "50%",
            bottom: "-22px",
            transform: "translateX(-50%)",
            zIndex: 3,
            whiteSpace: "nowrap",
          }}
        >
          На главную
        </Button>
      </Box>
    </Box>
  );
}