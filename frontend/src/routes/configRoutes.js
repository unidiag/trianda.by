import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import MainPage from "pages/MainPage";
import NotFound404 from "pages/NotFound404";

import { Navigate } from "react-router-dom";

import { Box, CircularProgress } from "@mui/material";
import { sendDataToServer } from "utils/functions";



const pages = require.context(
  "../pages",
  false,
  /Page\.jsx$/
);

function MainWithTitle(props) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t("company");
  }, [t, i18n.language]);

  return <MainPage {...props} />;
}





function pathToPageName(pathname) {
  const name = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("-")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join("");

  if (!name) {
    return null;
  }

  return `${name}Page.jsx`;
}

function DynamicPage() {
  const location = useLocation();

  const pageName = pathToPageName(
    location.pathname
  );

  if (!pageName) {
    return <NotFound404 />;
  }

  const modulePath = `./${pageName}`;

  if (!pages.keys().includes(modulePath)) {
    return <NotFound404 />;
  }

  const module = pages(modulePath);
  const Component = module.default;

  if (!Component) {
    return <NotFound404 />;
  }

  return <Component />;
}







function isInstaller() {
  try {
    const data = JSON.parse(
      localStorage.getItem("checkSubscriber") || "null"
    );

    return String(data?.personal) === "9999";
  } catch {
    return false;
  }
}

// Переадресация монтёра по QR-коду.
function InstallerQRRedirect({ box, fallbackUrl }) {
  useEffect(() => {
    let cancelled = false;

    const resolveQR = async () => {
      try {
        const data = await sendDataToServer({
          op: "guestResolveConnectBox",
          box,
        });

        if (cancelled) return;

        if (
          data?.status !== "OK" ||
          !data?.address?.house
        ) {
          throw new Error("Адрес по QR-коду не найден");
        }

        const address = data.address.house;

        const url =
          "https://master2.trianda.by/index.php" +
          "?module=stat" +
          "&house=" +
          encodeURIComponent(address);

        window.location.replace(url);
      } catch (err) {
        if (cancelled) return;

        console.error("QR redirect error:", err);

        // Если адрес не определился, показываем
        // обычную форму, которая сообщит об ошибке.
        window.location.replace(fallbackUrl);
      }
    };

    resolveQR();

    return () => {
      cancelled = true;
    };
  }, [box, fallbackUrl]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: 8,
      }}
    >
      <CircularProgress />
    </Box>
  );
}

// Обработка QR-ссылок на главной странице.
function MainOrConnect() {
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const box = params.get("box");

  if (box === null) {
    return <MainWithTitle />;
  }

  const connectUrl =
    "/connect" +
    location.search +
    (location.hash || "#digital");

  // Обычный абонент.
  if (!isInstaller()) {
    return <Navigate to={connectUrl} replace />;
  }

  // Монтёр.
  return (
    <InstallerQRRedirect
      box={box}
      fallbackUrl={connectUrl}
    />
  );
}






export const staticRoutes = [
  {
    path: "/",
    element: <MainOrConnect />,
  },
  {
    path: "*",
    element: <DynamicPage />,
  },
];