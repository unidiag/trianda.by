import { useEffect, useState } from "react";

import {
	Alert,
	Box,
	Button,
	Checkbox,
	CircularProgress,
	Container,
	FormControlLabel,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";

import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

import dayjs from "dayjs";
import "dayjs/locale/ru";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";

import { sendDataToServer } from "utils/functions";
import OfferDialog from "components/Adverts/OfferDialog";
import PublicationRulesDialog from "components/Adverts/PublicationRulesDialog";
import OrderSummary from "components/Adverts/OrderSummary";


const MAX_TEXT = 1000;
const FORM_STORAGE_KEY = "advert_form_data";
const SUBSCRIBER_STORAGE_KEY = "checkSubscriber";

function loadSubscriberName() {
    try {
        const value = localStorage.getItem(
            SUBSCRIBER_STORAGE_KEY
        );

        if (!value) {
            return "";
        }

        const data = JSON.parse(value);

        const surname =
            typeof data.surname === "string"
                ? data.surname.trim()
                : "";

        const personal =
            typeof data.personal === "string"
                ? data.personal.trim()
                : "";

        if (!surname || !personal) {
            return "";
        }

		const normalizedSurname =
		surname.charAt(0).toUpperCase() +
		surname.slice(1);

		return `${normalizedSurname} (л/с ${personal})`;
    } catch {
        return "";
    }
}


function loadFormData() {
	try {
		const value = localStorage.getItem(FORM_STORAGE_KEY);

		if (!value) {
			return {
				name: "",
				phone: "",
				companyDetails: "",
				showPhone: true,
				cashless: false,
			};
		}

		const data = JSON.parse(value);

		return {
			name:
				typeof data.name === "string"
					? data.name
					: "",

			phone:
				typeof data.phone === "string"
					? data.phone
					: "",

			companyDetails:
				typeof data.companyDetails === "string"
					? data.companyDetails
					: "",

			showPhone:
				typeof data.showPhone === "boolean"
					? data.showPhone
					: true,

			cashless:
				typeof data.cashless === "boolean"
					? data.cashless
					: false,
		};
	} catch {
		return {
			name: "",
			phone: "",
			companyDetails: "",
			showPhone: true,
			cashless: false,
		};
	}
}


function isValidPhone(value) {
	return (
		/^\d-\d{2}-\d{2}$/.test(value) ||
		/^8-\d{3}-\d{3}-\d{2}-\d{2}$/.test(value)
	);
}


function formatPhone(value) {
	const digits = value
		.replace(/\D/g, "")
		.slice(0, 11);

	// Короткий городской номер: X-XX-XX
	if (digits.length <= 5) {
		const parts = [];

		if (digits.length > 0) {
			parts.push(digits.slice(0, 1));
		}

		if (digits.length > 1) {
			parts.push(digits.slice(1, 3));
		}

		if (digits.length > 3) {
			parts.push(digits.slice(3, 5));
		}

		return parts.join("-");
	}

	// Мобильный номер: 8-XXX-XXX-XX-XX
	const parts = [];

	parts.push(digits.slice(0, 1));

	if (digits.length > 1) {
		parts.push(digits.slice(1, 4));
	}

	if (digits.length > 4) {
		parts.push(digits.slice(4, 7));
	}

	if (digits.length > 7) {
		parts.push(digits.slice(7, 9));
	}

	if (digits.length > 9) {
		parts.push(digits.slice(9, 11));
	}

	return parts.join("-");
}


function pluralDays(value) {
	const mod10 = value % 10;
	const mod100 = value % 100;

	if (mod10 === 1 && mod100 !== 11) {
		return "день";
	}

	if (
		mod10 >= 2 &&
		mod10 <= 4 &&
		(mod100 < 12 || mod100 > 14)
	) {
		return "дня";
	}

	return "дней";
}


function RangeDay(props) {
	const {
		day,
		dateStart,
		dateEnd,
		...other
	} = props;

	const isStart =
		dateStart &&
		day.isSame(dateStart, "day");

	const isEnd =
		dateEnd &&
		day.isSame(dateEnd, "day");

	const isInside =
		dateStart &&
		dateEnd &&
		day.isAfter(dateStart, "day") &&
		day.isBefore(dateEnd, "day");

	const isSelected =
		isStart ||
		isEnd;

	return (
		<Box
			sx={{
				position: "relative",
				display: "flex",
				justifyContent: "center",

				...(isInside && {
					backgroundColor: "action.selected",
				}),

				...(isStart &&
					dateEnd && {
						background: (theme) =>
							`linear-gradient(
								to right,
								transparent 50%,
								${theme.palette.action.selected} 50%
							)`,
					}),

				...(isEnd &&
					dateStart && {
						background: (theme) =>
							`linear-gradient(
								to right,
								${theme.palette.action.selected} 50%,
								transparent 50%
							)`,
					}),
			}}
		>
			<PickersDay
				{...other}
				day={day}
				selected={Boolean(isSelected)}
				sx={{
					zIndex: 1,

					"&.MuiPickersDay-today": {
						border: "none",
					},

					...(isSelected && {
						fontWeight: 600,
					}),
				}}
			/>
		</Box>
	);
}


export default function AddPage() {
	const [savedFormData] = useState(
		() => loadFormData()
	);

	const [savedSubscriberName] = useState(
		() => loadSubscriberName()
	);

	const [cashless, setCashless] =
		useState(savedFormData.cashless);

	const [name, setName] = useState(
		!savedFormData.cashless &&
		savedSubscriberName
			? savedSubscriberName
			: savedFormData.name
	);

	const [phone, setPhone] = useState(
		savedFormData.phone
	);

	const [showPhone, setShowPhone] = useState(
		savedFormData.showPhone
	);

	const [offerAccepted, setOfferAccepted] =
		useState(false);

	const [orderSummary, setOrderSummary] =
		useState([0, 0, 0, 0]);

	const [
		companyDetails,
		setCompanyDetails,
	] = useState(
		savedFormData.companyDetails
	);

	const [dateStart, setDateStart] = useState(
		dayjs().add(1, "day")
	);

	const [dateEnd, setDateEnd] =
		useState(null);

	const [text, setText] = useState("");

	const [showTV, setShowTV] = useState(true);
	const [showInt, setShowInt] = useState(true);
	const [showPan, setShowPan] = useState(false);

	const [sending, setSending] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");


	useEffect(() => {
		console.log(
			"Order summary:",
			orderSummary
		);
	}, [orderSummary]);


	useEffect(() => {
		const data = {
			name,
			phone,
			companyDetails,
			showPhone,
			cashless,
		};

		try {
			localStorage.setItem(
				FORM_STORAGE_KEY,
				JSON.stringify(data)
			);
		} catch {
			// localStorage недоступен
		}
	}, [
		name,
		phone,
		companyDetails,
		showPhone,
		cashless,
	]);


	const textLength =
		Array.from(text).length;


	const phoneError =
		phone.trim() !== "" &&
		!isValidPhone(phone);


	const periodError =
		!dateStart ||
		!dateEnd ||
		dateEnd.isBefore(
			dateStart,
			"day"
		);


	const placeSelected =
		showTV ||
		showInt ||
		showPan;


	const clearMessages = () => {
		setSuccess(false);
		setError("");
	};


	const handleTextChange = (event) => {
		const value = event.target.value
			.replace(/[\r\n]+/g, " ");

		setText(
			Array.from(value)
				.slice(0, MAX_TEXT)
				.join("")
		);

		clearMessages();
	};


	const handleDateChange = (value) => {
		if (!value) {
			return;
		}

		clearMessages();

		if (!dateStart || dateEnd) {
			setDateStart(value);
			setDateEnd(null);
			return;
		}

		if (value.isBefore(dateStart, "day")) {
			setDateStart(value);
			setDateEnd(null);
			return;
		}

		setDateEnd(value);
	};


	const handleSubmit = async (event) => {
		event.preventDefault();

		const nameValue = name.trim();
		const phoneValue = phone.trim();
		const textValue = text.trim();

		if (
			!nameValue ||
			(
				cashless &&
				!companyDetails.trim()
			) ||
			!phoneValue ||
			!isValidPhone(phoneValue) ||
			periodError ||
			!textValue ||
			!placeSelected ||
			sending
		) {
			return;
		}

		setSending(true);
		setSuccess(false);
		setError("");

		try {
			const data =
				await sendDataToServer({
					op: "guestAddStroka",

					name: nameValue,
					phone: phoneValue,
					text: textValue,

					datestart: dateStart
						.startOf("day")
						.unix()
						.toString(),

					dateend: dateEnd
						.endOf("day")
						.unix()
						.toString(),

					amount: orderSummary[3].toFixed(2),
					discount: orderSummary[2],

					beznal: cashless ? 1 : 0,

					address: cashless
						? companyDetails.trim()
						: "",

					sh_tv: showTV ? 1 : 0,
					sh_int: showInt ? 1 : 0,
					sh_pan: showPan ? 1 : 0,
				});

			if (data?.status !== "OK") {
				setError(
					data?.error ||
						data?.status ||
						"Не удалось добавить объявление"
				);

				return;
			}

			/*
			 * name, phone, companyDetails и
			 * showPhone не очищаем —
			 * они сохраняются в localStorage.
			 */

			setDateStart(
				dayjs().add(1, "day")
			);

			setDateEnd(null);
			setText("");

			setShowTV(true);
			setShowInt(true);
			setShowPan(false);

			setOfferAccepted(false);

			setSuccess(true);
		} catch {
			setError(
				"Не удалось добавить объявление"
			);
		} finally {
			setSending(false);
		}
	};


	const canSend =
		name.trim() !== "" &&
		(
			!cashless ||
			companyDetails.trim() !== ""
		) &&
		isValidPhone(phone) &&
		!periodError &&
		text.trim() !== "" &&
		orderSummary[0] >= 2 && // обявление 2 слова и более
		placeSelected &&
		offerAccepted &&
		!sending;


	const periodDays =
		dateStart && dateEnd
			? dateEnd.diff(
					dateStart,
					"day"
				) + 1
			: 0;


	const isTodayStart =
		dateStart &&
		dateStart.isSame(
			dayjs(),
			"day"
		);


	const isAfterTenToday =
		isTodayStart &&
		dayjs().hour() >= 10;


	return (
		<LocalizationProvider
			dateAdapter={AdapterDayjs}
			adapterLocale="ru"
		>
			<Container
				maxWidth="sm"
				sx={{
					py: {
						xs: 3,
						sm: 5,
					},
				}}
			>
				<Box
					component="form"
					onSubmit={handleSubmit}
				>
					<Box
						sx={{
							display: "flex",
							justifyContent:
								"space-between",
							alignItems: "center",
							gap: 0.5,
							mb: 3,
						}}
					>
						<Typography
							variant="h4"
							sx={{
								fontSize: {
									xs: "1.7rem",
									sm: "2rem",
								},
							}}
						>
							Подать объявление
						</Typography>

						<PublicationRulesDialog />
					</Box>

					<Stack spacing={2}>
						<FormControlLabel
							control={
								<Checkbox
									checked={cashless}
									onChange={(
										event
									) => {
										setCashless(
											event
												.target
												.checked
										);

										clearMessages();
									}}
									disabled={
										sending
									}
								/>
							}
							label="Безналичный расчёт для юрлиц"
						/>

						<TextField
							label={
								cashless
									? "Название организации"
									: "ФИО"
							}
							value={name}
							onChange={(event) => {
								setName(event.target.value);
								clearMessages();
							}}
							fullWidth
							disabled={sending}
							inputProps={{
								maxLength: 250,
							}}
						/>

						{cashless && (
							<TextField
								label="Реквизиты организации"
								value={
									companyDetails
								}
								onChange={(
									event
								) => {
									setCompanyDetails(
										event
											.target
											.value
									);

									clearMessages();
								}}
								multiline
								minRows={4}
								fullWidth
								disabled={
									sending
								}
								placeholder="УНП, юридический адрес, расчётный счёт, банк, БИК и тп."
								inputProps={{
									maxLength: 1000,
								}}
							/>
						)}

						<Box
							sx={{
								display: "grid",
								gridTemplateColumns:
									{
										xs: "1fr",
										sm: "1fr auto",
									},
								gap: 2,
								alignItems:
									"start",
							}}
						>
							<TextField
								label="Телефон"
								value={phone}
								onChange={(event) => {
									setPhone(
										formatPhone(event.target.value)
									);

									clearMessages();
								}}
								placeholder="8-029-123-45-67"
								error={
									phoneError
								}
								helperText={
									phoneError
										? "Введите корректный номер телефона"
										: " "
								}
								fullWidth
								disabled={
									sending
								}
								inputProps={{
									maxLength: 50,
								}}
							/>

							<FormControlLabel
								control={
									<Checkbox
										checked={
											showPhone
										}
										onChange={(
											event
										) => {
											setShowPhone(
												event
													.target
													.checked
											);

											clearMessages();
										}}
										disabled={
											sending
										}
									/>
								}
								label={
									<Box
										sx={{
											fontSize:
												"12px",
											lineHeight:
												"15px",
										}}
									>
										Использовать
										в объявлении

										<Box
											sx={{
												color:
													"text.secondary",
												fontStyle:
													"italic",
											}}
										>
											(не тарифицируется)
										</Box>
									</Box>
								}
								sx={{
									mt: {
										xs: 0,
										sm: 1,
									},
									whiteSpace:
										"nowrap",
								}}
							/>
						</Box>

						<Box>
							<Paper
								variant="outlined"
								sx={{
									overflow:
										"hidden",
								}}
							>
								<DateCalendar
									value={
										dateEnd ||
										dateStart
									}
									onChange={
										handleDateChange
									}
									minDate={
										dayjs().hour() >= 20
											? dayjs().add(1, "day")
											: dayjs()
									}
									maxDate={dayjs()
										.add(
											2,
											"month"
										)
										.endOf(
											"month"
										)}
									views={[
										"day",
									]}
									openTo="day"
									disabled={
										sending
									}
									slots={{
										day: RangeDay,
									}}
									slotProps={{
										day: {
											dateStart,
											dateEnd,
										},
									}}
									sx={{
										width:
											"100%",

										"& .MuiDayCalendar-weekContainer":
											{
												margin: 0,
											},

										"& .MuiDayCalendar-weekDayLabel":
											{
												width: 40,
											},
									}}
								/>

								<Typography
									variant="subtitle2"
									color="text.secondary"
									sx={{
										mb: 1.5,
										textAlign:
											"center",
									}}
								>
									Период:{" "}

									<strong>
										{dateStart
											? `с ${dateStart.format(
													"DD.MM.YYYY"
												)} по `
											: "—"}

										{!dateEnd &&
											"..."}

										{dateEnd && (
											<>
												{dateEnd.format(
													"DD.MM.YYYY"
												)}

												<Box
													component="span"
													sx={{
														ml: 1.5,
														color:
															"success.main",
														fontWeight: 700,
													}}
												>
													{
														periodDays
													}{" "}
													{pluralDays(
														periodDays
													)}
												</Box>
											</>
										)}
									</strong>
								</Typography>

								{periodError && (
									<Alert
										severity="warning"
										sx={{
											mx: 2,
											mb: 1.5,
										}}
									>
										Выберите
										дату
										последнего
										дня
										трансляции
									</Alert>
								)}

								{isTodayStart && (
									<Alert
										severity="info"
										sx={{
											mx: 2,
											mb: 1.5,
										}}
									>
										Объявление
										будет
										опубликовано
										сегодня,
										через
										10-15
										минут
										после
										оплаты
									</Alert>
								)}

								{isAfterTenToday && (
									<Alert
										severity="warning"
										sx={{
											mx: 2,
											mb: 1.5,
										}}
									>
										Обращаем
										Ваше
										внимание,
										что
										обновление
										городских
										светодиодных
										панелей
										происходит
										ежедневно
										до 10
										часов
										утра
									</Alert>
								)}
							</Paper>
						</Box>

						<Box
							sx={{
								position:
									"relative",
							}}
						>
							<TextField
								label="Текст объявления (от 2 слов)"
								value={text}
								onChange={
									handleTextChange
								}
								onKeyDown={(
									event
								) => {
									if (
										event.key ===
										"Enter"
									) {
										event.preventDefault();
									}
								}}
								multiline
								minRows={3}
								fullWidth
								disabled={
									sending
								}
								helperText={`${textLength} / ${MAX_TEXT}`}
								sx={{
									"& .MuiInputBase-inputMultiline":
										{
											pb:
												showPhone &&
												phone.trim() !==
													""
													? 4.5
													: 2,
										},
								}}
								FormHelperTextProps={{
									sx: {
										textAlign: "right",
										mx: 0,
									},
								}}
							/>

							{showPhone &&
								phone.trim() !==
									"" && (
									<Typography
										variant="body2"
										sx={{
											position:
												"absolute",
											right: 14,
											bottom: 29,
											fontWeight: 500,
											pointerEvents:
												"none",
										}}
									>
										+ Тел.{" "}
										{phone}
									</Typography>
								)}
						</Box>



						<Box
							sx={{
								pt: 1,
							}}
						>
							<OrderSummary
								text={text}
								periodDays={
									periodDays
								}
								periodLabel={pluralDays(
									periodDays
								)}
								cashless={
									cashless
								}
								onSummaryChange={
									setOrderSummary
								}
							/>

							<FormControlLabel
								control={
									<Checkbox
										checked={
											offerAccepted
										}
										onChange={(
											event
										) => {
											setOfferAccepted(
												event
													.target
													.checked
											);

											clearMessages();
										}}
										disabled={
											sending
										}
									/>
								}
								label={
									<Typography component="span">
										Я ознакомлен
										и согласен
										с{" "}
										<OfferDialog />
									</Typography>
								}
								sx={{
									m: 1,
								}}
							/>


							{success && (
								<Alert severity="success">
									Объявление успешно
									отправлено
								</Alert>
							)}

							{error && (
								<Alert severity="error">
									{error}
								</Alert>
							)}

							<Button
								type="submit"
								variant="contained"
								size="large"
								sx={{mt:2}}
								disabled={
									!canSend
								}
								startIcon={
									sending ? (
										<CircularProgress
											size={
												18
											}
											color="inherit"
										/>
									) : (
										<AddCircleOutlineIcon />
									)
								}
							>
								{sending
									? "Отправка..."
									: "Подать объявление"}
							</Button>
						</Box>
					</Stack>
				</Box>
			</Container>
		</LocalizationProvider>
	);
}