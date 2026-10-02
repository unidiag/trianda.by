import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import MainPage from "pages/MainPage";
import NotFound404 from "pages/NotFound404";

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

export const staticRoutes = [
  {
    path: "/",
    element: <MainWithTitle />,
  },
  {
    path: "*",
    element: <DynamicPage />,
  },
];