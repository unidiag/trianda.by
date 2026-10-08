import { useState } from "react";

import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	List,
	ListItem,
	Tooltip,
	Typography,
} from "@mui/material";

import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import OfferDialog from "components/Adverts/OfferDialog";
import { Link } from "@mui/material";




export default function PublicationRulesDialog() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip title="Правила публикации объявлений">
				<IconButton
					type="button"
					color="warning"
					onClick={() => setOpen(true)}
					aria-label="Правила публикации объявлений"
				>
					<WarningAmberOutlinedIcon />
				</IconButton>
			</Tooltip>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				fullWidth
				maxWidth="md"
				scroll="paper"
			>
				<DialogTitle>
					Общие положения публикации объявлений
				</DialogTitle>

				<DialogContent dividers>
					<Box
						sx={{
							"& p": {
								mb: 1.5,
							},
						}}
					>


					<Box>
					<Typography variant="body1" sx={{ mb: 1 }}>
						Коммерческие объявления публикуются на следующих рекламных средствах:
					</Typography>

					<List
						dense
						sx={{
						listStyleType: "disc",
						pl: 3,
						py: 0,
						"& .MuiListItem-root": {
							display: "list-item",
							py: 0.4,
							pl: 0,
						},
						}}
					>
						{[
						{
							title: "Инфоканал в сети КТВ",
							href: "/sources/infocanal_dtv.jpg",
						},
						{
							title: "Световое табло на Панчука, 4",
							href: "/sources/stroka_panchuka4.jpg",
						},
						{
							title: "Световое табло на Энергетиков, 15",
							href: "/sources/stroka_ispolkom.jpg",
						},
						{
							title: "Сайт TRIANDA.BY",
							href: "/base",
						},
						{
							title: "Telegram-канал Новолукомля",
							href: "https://t.me/novolukoml_official",
						},
						{
							title: "Интеграция объявлений в телегид",
							href: null,
						},
						].map((item) => (
						<ListItem key={item.title}>
							{item.href ? (
							<Link
								href={item.href}
								target="_blank"
								rel="noopener noreferrer"
								underline="hover"
								color="primary"
								sx={{ fontSize: "inherit" }}
							>
								{item.title}
							</Link>
							) : (
							<Typography variant="body2">
								{item.title}
							</Typography>
							)}
						</ListItem>
						))}
					</List>
					</Box>


						<Typography>
							— текст объявления должен быть лаконичен от двух слов и более,
							предельно ясен в понимании и без грамматических ошибок.
						</Typography>

						<Typography>
							—{" "}
							<Box
								component="span"
								sx={{
									fontWeight: 700,
								}}
							>
								не допускается использование неоправданно частых сокращений
								слов менее 5 символов
							</Box>
							. Такое объявление будет отклонено редактором.
						</Typography>

						<Typography>
							Перед тем как подать заявку на размещение рекламы, ознакомьтесь
							и согласитесь с <OfferDialog /> {" "}
							на размещение рекламы.
						</Typography>

						<Typography
							sx={{
								fontWeight: 700,
								mt: 2.5,
							}}
						>
							Стоимость размещения информации в бегущей строке:
						</Typography>

						<Typography>
							— 1.00 руб/слово в сутки для физических лиц;
						</Typography>

						<Typography>
							— 2.00 руб/слово в сутки для юридических лиц.
						</Typography>

						<Typography sx={{ mt: 2 }}>
							Действует гибкая система скидок для постоянных клиентов и в
							зависимости от суммы заказа. Окончальная стоимость рассчитывается онлайн-калькулятором
							на странице подачи заявки.
						</Typography>

						<Typography
							sx={{
								fontWeight: 700,
								mt: 2.5,
							}}
						>
							Оплатить размещение рекламы можно следующими способами:
						</Typography>

						<Typography sx={{ fontWeight: 700 }}>
							— в банках города
						</Typography>

						<Typography sx={{ fontWeight: 700 }}>
							— в инфокиосках банков
						</Typography>

						<Typography sx={{ fontWeight: 700 }}>
							— в отделениях Белпочты
						</Typography>

						<Typography sx={{ fontWeight: 700 }}>
							— через интернет-банкинг (ЕРИП)
						</Typography>

						<Typography sx={{ mt: 2.5 }}>
							<Box
								component="span"
								sx={{
									fontWeight: 700,
								}}
							>
								Путь в системе ЕРИП:
							</Box>{" "}
							Интернет, телевидение, телефония » Прочие организации »
							Витебская обл. » Чашники и Чашникский р-н » ТриАнда »
							Реклама, объявления
						</Typography>

						<Typography>
							или по поиску: НАЗВАНИЕ ПОЛУЧАТЕЛЯ » ТриАнда
						</Typography>

						<Typography>
							<Box
								component="span"
								sx={{
									fontWeight: 700,
								}}
							>
								Код услуги в ЕРИП:
							</Box>{" "}
							187263
						</Typography>

                        <Typography sx={{ mt: 2.5 }}>
                            Справки по тел.{" "}

                            <Link
                                href="tel:+375213368388"
                                underline="hover"
                                sx={{
                                    fontWeight: 700,
                                    color: "primary.main",
                                }}
                            >
                                8-02133-6-83-88
                            </Link>

                            {" "}
                            (в рабочее время) или{" "}

                            <Link
                                href="tel:+375295957885"
                                underline="hover"
                                sx={{
                                    fontWeight: 700,
                                    color: "primary.main",
                                }}
                            >
                                8-029-595-78-85
                            </Link>

                            {" "}
                            (дежурная служба с 9 до 21) в выходные и праздничные дни.
                        </Typography>
					</Box>
				</DialogContent>

				<DialogActions>
					<Button
						onClick={() => setOpen(false)}
						variant="contained"
					>
						Закрыть
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}