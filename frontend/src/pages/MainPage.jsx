import React from "react";
import { Box } from "@mui/material";

import TvIcon from "@mui/icons-material/Tv";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CampaignIcon from "@mui/icons-material/Campaign";
import StorageIcon from "@mui/icons-material/Storage";
import BusinessIcon from "@mui/icons-material/Business";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ContactMailIcon from "@mui/icons-material/ContactMail";

import ButtonsMain from "components/ButtonsMain";

export default function MainPage() {
  const sections = [
    {
      title: "Подключиться",
      buttons: [
        {
          title: "Аналоговый пакет",
          subtitle: "51 канал за 10.50 р/мес",
          to: "/connect#analog",
          icon: <TvIcon />,
        },
        {
          title: "Цифровой пакет",
          subtitle: "более 80 каналов за 16.00 р/мес",
          to: "/connect#digital",
          icon: <TvIcon />,
          sx: {
            bgcolor: "#9ACD32",
            color: "#172000",

            "&:hover": {
              bgcolor: "#88b82c",
            },
          },
        },
        {
          title: "Интерактивное IPTV",
          subtitle: "более 80 каналов за 9.99 р/мес",
          to: "/connect#iptv",
          icon: <TvIcon />,
          sx: {
            bgcolor: "#7e57c2",
            color: "#fff",

            "&:hover": {
              bgcolor: "#6d49ad",
            },
          },
        },
      ],
    },
    {
      title: "Лицевой счёт",
      buttons: [
        {
          title: "Оплатить",
          to: "/pay",
          icon: <AccountBalanceWalletIcon />,
        },
        {
          title: "Проверить",
          to: "/check",
          icon: <SearchIcon />,
        },
      ],
    },
    {
      title: "Объявления",
      buttons: [
        {
          title: "Добавить",
          subtitle: "подача объявления",
          to: "/add",
          icon: <AddCircleOutlineIcon />,
        },
        {
          title: "Инфоканал",
          subtitle: "Прямой эфир",
          to: "/live",
          icon: <CampaignIcon />,
        },
        {
          title: "База данных",
          subtitle: "всех объявлений",
          to: "/base",
          icon: <StorageIcon />,
        },
      ],
    },
    {
      title: "Контакты",
      buttons: [
        {
          title: "О компании",
          to: "/about",
          icon: <BusinessIcon />,
        },
        {
          title: "Реквизиты",
          to: "/details",
          icon: <AccountBalanceIcon />,
        },
        {
          title: "Обратная связь",
          to: "/contact",
          icon: <ContactMailIcon />,
        },
      ],
    },
  ];

  return (
    <Box>
      {sections.map((section) => (
        <ButtonsMain
          key={section.title}
          title={section.title}
          buttons={section.buttons}
        />
      ))}
    </Box>
  );
}