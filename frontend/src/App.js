import React, { useEffect, useRef, useState } from "react";
import { Box, Container } from "@mui/material";
import Logo from "components/Logo";
import ThemeToggleButton from "components/ThemeToggleButton";
import InstallAppButton from "components/InstallAppButton";
import { useLocation, useRoutes } from "react-router-dom";
import { staticRoutes } from "routes/configRoutes";

function App() {
  const location = useLocation();

  const [displayLocation, setDisplayLocation] = useState(location);
  const [visible, setVisible] = useState(true);

  const timerRef = useRef(null);

  const page = useRoutes(staticRoutes, displayLocation);

  const locationKey =
    location.pathname + location.search + location.hash;

  const displayLocationKey =
    displayLocation.pathname +
    displayLocation.search +
    displayLocation.hash;

  useEffect(() => {
    if (locationKey === displayLocationKey) {
      return;
    }

    setVisible(false);

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setDisplayLocation(location);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    }, 300);

    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line
  }, [locationKey, displayLocationKey]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
      }}
    >
      <Box
        component="header"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: "background.default",
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: {
              xs: 72,
              sm: 84,
            },
            borderBottom: "1px solid",
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: {
                xs: 16,
                sm: 24,
              },
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <InstallAppButton />
          </Box>

          <Logo />

          <Box
            sx={{
              position: "absolute",
              right: {
                xs: 16,
                sm: 24,
              },
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <ThemeToggleButton />
          </Box>
        </Container>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          pt: {
            xs: "72px",
            sm: "84px",
          },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {page}
        </Container>
      </Box>

      <Box
        component="footer"
        sx={{
          flexShrink: 0,
          py: 1.5,
          textAlign: "center",
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
          color: "text.secondary",
          fontSize: "0.75rem",
        }}
      >
        © {new Date().getFullYear()} ООО «ТриАнда»
      </Box>
    </Box>
  );
}

export default App;