import React from "react";
import {
  Box,
  Divider,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Button,
  Typography,
} from "@mui/material";
import DocumentViewer from "components/DocumentViewer";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

export default function DetailsPage() {


  const [showEmail, setShowEmail] = React.useState(false);
  const email = "yb.adnairt@ofni".split("").reverse().join("");
  const [document, setDocument] = React.useState(null);



    const documents = [
    {
        title: "Свидетельство о регистрации юрлица",
        href: "/sources/svid_o_reg.jpg",
    },
    {
        title: "Лицензия Министерства связи Беларуси",
        href: "/sources/minsvyaz.jpg",
    },
    {
        title: "Лицензия СМИ «Телепрограмма «ТриАнда»",
        href: "/sources/lic_smi.jpg",
    },
    {
        title: "Политика обработки персональных данных",
        href: "/sources/politics.pdf",
    },
    ];




  return (
    <Box
      sx={{
        py: {
          xs: 2,
          sm: 3,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          p: {
            xs: 2,
            sm: 3,
            md: 4,
          },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            mb: 2,
            fontSize: {
              xs: "1.6rem",
              sm: "2rem",
            },
          }}
        >
          Реквизиты и лицензии
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Typography
          sx={{
            fontWeight: 700,
            mb: 0.5,
          }}
        >
          Общество с ограниченной ответственностью «ТриАнда»
        </Typography>

        <Typography paragraph>
          (ООО «ТриАнда»)
        </Typography>

        <Typography paragraph>
          211162, Республика Беларусь, Витебская область,
          г. Новолукомль, ул. Энергетиков 15 (горисполком),
          3-й этаж, каб. 302, 303
        </Typography>

        <Typography paragraph>
          <Box component="strong">УНН:</Box> 300015881
          <br />
          <Box component="strong">ОКПО:</Box> 28686306
        </Typography>

        <Typography paragraph>
          <Box component="strong">Р/с:</Box>{" "}
          BY78AKBB30121239200082200000 в ОАО «АСБ Беларусбанк»
          <br />
          <Box component="strong">Код банка:</Box> AKBBBY2X
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 2 }}>
        <Box component="strong">Email:</Box>{" "}

        {!showEmail ? (
            <Button
            size="small"
            variant="text"
            onClick={() => setShowEmail(true)}
            sx={{
                minWidth: 0,
                p: 0,
                ml: 0.5,
                verticalAlign: "baseline",
                textTransform: "none",
            }}
            >
            Показать email
            </Button>
        ) : (
            <Link
            href={`mailto:${email}`}
            underline="hover"
            >
            {email}
            </Link>
        )}
        </Box>

        <Typography paragraph>
          <Box component="strong">
            Абонентный отдел:
          </Box>{" "}
          <Link
            href="tel:+375213368388"
            underline="hover"
          >
            8 (02133) 6-83-88
          </Link>
          <br />

          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
            }}
          >
            Время работы: с 8:00 до 17:00 ПН–ПТ,
            обед 13:00–14:00
          </Typography>
        </Typography>

        <Typography paragraph>
          <Box component="strong">
            Дежурный диспетчер:
          </Box>{" "}
          <Link
            href="tel:+375295957885"
            underline="hover"
          >
            +375 (29) 595-78-85
          </Link>{" "}
          МТС
          <br />

          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
            }}
          >
            Время работы: ежедневно с 9:00 до 21:00
          </Typography>
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontWeight: 700,
            mb: 1.5,
          }}
        >
          Документы
        </Typography>

        <List
        sx={{
            p: 0,
        }}
        >
        {documents.map((item) => (
            <ListItem
            key={item.href}
            sx={{
                px: 0,
                py: 0.5,
            }}
            >
            <ListItemIcon
                sx={{
                minWidth: 36,
                color: "text.secondary",
                }}
            >
                <InsertDriveFileOutlinedIcon />
            </ListItemIcon>

            <ListItemText
                primary={
                <Link
                    component="button"
                    type="button"
                    underline="hover"
                    onClick={() => setDocument(item)}
                    sx={{
                    textAlign: "left",
                    fontSize: "inherit",
                    }}
                >
                    {item.title}
                </Link>
                }
            />
            </ListItem>
        ))}
        </List>

        <DocumentViewer
          open={Boolean(document)}
          onClose={() => setDocument(null)}
          title={document?.title || ""}
          src={document?.href || ""}
        />


      </Paper>
    </Box>
  );
}