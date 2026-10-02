import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CssBaseline,
  ThemeProvider,
  createTheme,
} from "@mui/material";

export const ThemeModeContext = createContext({
  mode: "light",
  toggleMode: () => {},
});

const STORAGE_KEY = "ui:mode";

export default function ThemeModeProvider({
  children,
  defaultMode = "dark",
}) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved === "dark" || saved === "light") {
        return saved;
      }
    } catch {}

    return defaultMode;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((current) =>
      current === "dark" ? "light" : "dark"
    );
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,

          primary: {
            main: "#1976d2",
          },

          secondary: {
            main: "#00a6c8",
          },

          ...(mode === "light"
            ? {
                background: {
                  default: "#f7f9fc",
                  paper: "#ffffff",
                },
              }
            : {
                background: {
                  default: "#0f141c",
                  paper: "#171d26",
                },
              }),
        },

        typography: {
          fontFamily: [
            "Inter",
            "Roboto",
            "Arial",
            "sans-serif",
          ].join(","),

          h1: {
            fontWeight: 800,
          },

          h2: {
            fontWeight: 800,
          },

          h3: {
            fontWeight: 800,
          },

          h4: {
            fontWeight: 700,
          },

          h5: {
            fontWeight: 700,
          },

          h6: {
            fontWeight: 700,
          },

          button: {
            textTransform: "none",
            fontWeight: 600,
          },
        },

        shape: {
          borderRadius: 12,
        },

        components: {
          MuiCssBaseline: {
            styleOverrides: {
              html: {
                scrollBehavior: "smooth",
              },

              body: {
                margin: 0,
              },
            },
          },

          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                boxShadow: "none",
              },
            },
          },

          MuiCard: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    [mode]
  );

  const contextValue = useMemo(
    () => ({
      mode,
      toggleMode,
    }),
    [mode, toggleMode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
