import React from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

export default function ButtonsMain({
  title,
  buttons = [],
}) {
  return (
    <Box
      sx={{
        position: "relative",
        mt: 4,
        mb: 2,
        px: {
          xs: 2,
          sm: 3,
        },
        pt: 3,
        pb: 2.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      {title && (
        <Typography
          sx={{
            position: "absolute",
            top: 0,
            left: {
              xs: 16,
              sm: 24,
            },
            transform: "translateY(-50%)",
            px: 1,
            bgcolor: "background.default",
            fontSize: "1rem",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {title}
        </Typography>
      )}

      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        spacing={1.5}
        justifyContent="center"
        alignItems="center"
      >
        {buttons.map((button) => (
          <Button
            key={button.to || button.href}
            component={button.href ? "a" : Link}
            to={button.href ? undefined : button.to}
            href={button.href || undefined}
            target={button.href ? "_blank" : undefined}
            rel={button.href ? "noopener noreferrer" : undefined}
            disabled={button.disabled ?? false}
            variant="contained"
            size="large"
            sx={{
              minWidth: {
                xs: "100%",
                sm: 180,
              },
              width: {
                xs: "100%",
                sm: "auto",
              },
              minHeight: 64,
              px: 3,
              py: 1.2,
              textTransform: "none",
              ...(button.sx || {}),
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
              }}
            >
              {button.icon && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",

                    "& svg": {
                      fontSize: 24,
                    },
                  }}
                >
                  {button.icon}
                </Box>
              )}

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: 1.2,
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {button.title}
                </Typography>

                {button.subtitle && (
                  <Typography
                    component="span"
                    sx={{
                      mt: 0.4,
                      fontSize: "0.75rem",
                      fontWeight: 400,
                      lineHeight: 1.2,
                      opacity: 0.8,
                    }}
                  >
                    {button.subtitle}
                  </Typography>
                )}
              </Box>
            </Box>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}