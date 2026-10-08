import React, { useContext } from "react";

import { IconButton, Tooltip } from "@mui/material";

import {
  DarkModeRounded,
  LightModeRounded,
} from "@mui/icons-material";

import { ThemeModeContext } from "../ThemeProvider";

function ThemeToggleButton() {
  const { mode, toggleMode } = useContext(ThemeModeContext);

  const isDark = mode === "dark";

  return (
    <Tooltip
      title={
        isDark
          ? "Включить светлую тему"
          : "Включить тёмную тему"
      }
    >
      <IconButton
        onClick={toggleMode}
        color="inherit"
        aria-label="Переключить тему"
      >
        {isDark ? (
          <LightModeRounded />
        ) : (
          <DarkModeRounded />
        )}
      </IconButton>
    </Tooltip>
  );
}

export default ThemeToggleButton;
