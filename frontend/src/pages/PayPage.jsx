import {
  Box,
  Breadcrumbs,
  Chip,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import PaymentIcon from "@mui/icons-material/Payment";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";


export default function PayPage() {
  const eripPath = [
    "Интернет, телевидение, телефония",
    "Прочие организации",
    "Витебская обл.",
    "Чашникский р-н",
    "ТриАнда",
    "Абонентская плата",
  ];

  return (
    <Container
      maxWidth="md"
      sx={{
        py: {
          xs: 3,
          sm: 5,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: {
            xs: 2,
            sm: 3,
          },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <PaymentIcon color="primary" />

          <Typography
            variant="h4"
            sx={{
              fontSize: {
                xs: "1.6rem",
                sm: "2rem",
              },
            }}
          >
            Как оплатить
          </Typography>
        </Box>

        <Typography
          variant="h6"
          sx={{
            mb: 1,
          }}
        >
          Способы оплаты
        </Typography>

        <List
          sx={{
            pl: {
              xs: 1,
              sm: 3,
            },
            mb: 3,
          }}
        >
          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            <ListItemText
              primary={
                <>
                  в банках города{" "}
                  <Box
                    component="span"
                    sx={{
                      fontWeight: 600,
                    }}
                  >
                    (самая низкая комиссия в «Белагропромбанке»)
                  </Box>
                </>
              }
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            <ListItemText
              primary="в инфокиосках банков (без комиссии)"
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            <ListItemText
              primary="в отделениях Белпочты (комиссия 0.6 руб. за один платёж)"
            />
          </ListItem>

          <ListItem
            sx={{
              display: "list-item",
              listStyleType: "disc",
              py: 0.25,
            }}
          >
            <ListItemText
              primary="через интернет-банкинг (ЕРИП) (без комиссии)"
            />
          </ListItem>
        </List>

        <Box
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
            },
            mb: 3,
            borderRadius: 2,
            bgcolor: "action.hover",
          }}
        >
          <Typography
            sx={{
              mb: 1.5,
              fontWeight: 600,
            }}
          >
            Путь в системе ЕРИП
          </Typography>

          <Breadcrumbs
            separator={
              <NavigateNextIcon
                fontSize="small"
                color="action"
              />
            }
            sx={{
              "& .MuiBreadcrumbs-ol": {
                alignItems: "center",
              },
              "& .MuiBreadcrumbs-li": {
                mb: 0.5,
              },
            }}
          >
            {eripPath.map((item) => (
              <Chip
                key={item}
                label={item}
                size="small"
                variant="outlined"
              />
            ))}
          </Breadcrumbs>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1.5,
            }}
          >
            Также можно воспользоваться поиском
            по названию получателя:
          </Typography>

          <Typography
            sx={{
              mt: 0.5,
              fontWeight: 600,
            }}
          >
            ТриАнда
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "primary.main",
            borderRadius: 2,
          }}
        >
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={1}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            justifyContent="space-between"
          >
            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Код услуги в ЕРИП
              </Typography>

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Для быстрого поиска
              </Typography>
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              5123
            </Typography>
          </Stack>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 3,
          }}
        >
          Перед подтверждением платежа внимательно
          проверяйте введённые данные.
        </Typography>
      </Paper>
    </Container>
  );
}