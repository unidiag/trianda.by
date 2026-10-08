import React, { useEffect, useState } from "react";
import {
  IconButton,
  Tooltip,
} from "@mui/material";

import TurnedInNotIcon from "@mui/icons-material/TurnedInNot";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useNavigate, useLocation } from "react-router-dom";

import { useToast } from "../utils/useToast";

export default function InstallAppButton() {
  const toast = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  const isAndroid =
    /android/i.test(navigator.userAgent);

  const canInstall =
    !installed &&
    (
      isIOS ||
      isAndroid ||
      Boolean(deferredPrompt)
    );

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setInstalled(true);
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);

      toast.success("Приложение установлено");
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, [toast]);

  const handleInstall = async () => {
    if (installed) {
      return;
    }

    if (isIOS) {
      toast.info(
        'Для установки нажмите «Поделиться» → «На экран Домой»'
      );

      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();

      const result = await deferredPrompt.userChoice;

      if (result.outcome === "accepted") {
        toast.info("Установка приложения...");
      }

      setDeferredPrompt(null);

      return;
    }

    if (isAndroid) {
      toast.info(
        'Откройте меню браузера → «Установить приложение» или «Добавить на главный экран»'
      );

      return;
    }

    toast.info("Установка приложения недоступна");
  };

  if (location.pathname !== "/") {
    return (
      <Tooltip title="На главную">
        <IconButton
          onClick={() => navigate("/")}
          color="inherit"
        >
          <ArrowBackIcon />
        </IconButton>
      </Tooltip>
    );
  }

  if (!canInstall) {
    return null;
  }

  let tooltip = "Установить приложение";

  if (isIOS) {
    tooltip = "Добавить на экран Домой";
  } else if (isAndroid && !deferredPrompt) {
    tooltip = "Добавить на главный экран";
  }

  return (
    <Tooltip title={tooltip}>
      <IconButton
        onClick={handleInstall}
        color="inherit"
      >
        <TurnedInNotIcon />
      </IconButton>
    </Tooltip>
  );
}