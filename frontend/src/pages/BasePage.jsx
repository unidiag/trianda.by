import { Fragment, useEffect, useRef, useState } from "react";

import {
	Box,
	Card,
	CardContent,
	CircularProgress,
	Container,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
    Checkbox,
    FormControlLabel,
    Button,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import BusinessIcon from "@mui/icons-material/Business";


import { sendDataToServer } from "utils/functions";
import { Link } from "react-router-dom";

function getToday() {
	const now = new Date();

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}



function linkifyPhones(text, searchText = "") {
	if (!text) {
		return text;
	}

	const phoneRegex =
		/(\+375[\s\u00A0\u202F-]?\(?\d{2}\)?[\s\u00A0\u202F-]?\d{3}[\s\u00A0\u202F-]?\d{2}[\s\u00A0\u202F-]?\d{2}|8[\s\u00A0\u202F-]?\(?0\d{2}\)?[\s\u00A0\u202F-]?\d{3}[\s\u00A0\u202F-]?\d{2}[\s\u00A0\u202F-]?\d{2}|\b\d[ \u00A0\u202F\u2010\u2011\u2012\u2013\u2014-]\d{2}[ \u00A0\u202F\u2010\u2011\u2012\u2013\u2014-]\d{2}\b)/g;

	const parts = text.split(phoneRegex);

	return parts.map((part, index) => {
		const digits = part.replace(/\D/g, "");

		let phone = null;

		if (part.trim().startsWith("+375") && digits.length === 12) {
			phone = "+" + digits;
		} else if (/^80\d{9}$/.test(digits)) {
			phone = "+375" + digits.slice(2);
		} else if (
			/^\d[ \u00A0\u202F\u2010\u2011\u2012\u2013\u2014-]\d{2}[ \u00A0\u202F\u2010\u2011\u2012\u2013\u2014-]\d{2}$/.test(
				part
			)
		) {
			phone = "+3752133" + digits;
		}

		if (!phone) {
			return (
				<Fragment key={index}>
					{highlightText(part, searchText)}
				</Fragment>
			);
		}

		return (
			<Box
				key={index}
				component="a"
				href={`tel:${phone}`}
				sx={{
					color: "primary.main",
					textDecoration: "none",
					fontWeight: 600,
					"&:hover": {
						textDecoration: "underline",
					},
				}}
			>
				{highlightText(part, searchText)}
			</Box>
		);
	});
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, searchText) {
	if (!text || !searchText) {
		return text;
	}

	const words = searchText
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map(escapeRegExp);

	if (words.length === 0) {
		return text;
	}

	const regex = new RegExp(`(${words.join("|")})`, "gi");

	return text.split(regex).map((part, index) => {
		const matched = words.some(
			(word) =>
				new RegExp(`^${word}$`, "i").test(part)
		);

		if (!matched) {
			return part;
		}

		return (
			<Box
				key={index}
				component="span"
				sx={{
					backgroundColor: "yellow",
					color: "red",
					borderRadius: 0.1,
				}}
			>
				{part}
			</Box>
		);
	});
}








export default function BasePage() {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);

	const [mode, setMode] = useState("date");
	const [date, setDate] = useState(getToday());
    const [commercialOnly, setCommercialOnly] = useState(false);


	const [text, setText] = useState("");
	const [searchText, setSearchText] = useState("");

	const [page, setPage] = useState(1);
	const [pages, setPages] = useState(0);
	const [total, setTotal] = useState(0);

	const loadMoreRef = useRef(null);
	const searchInputRef = useRef(null);

	useEffect(() => {
		if (mode !== "text") {
			return;
		}

		const timer = setTimeout(() => {
			setSearchText(text.trim());
		}, 500);

		return () => clearTimeout(timer);
	}, [text, mode]);

    useEffect(() => {
        setItems([]);
        setPage(1);
        setPages(0);
        setTotal(0);
    }, [mode, date, searchText, commercialOnly]);

	useEffect(() => {
		let active = true;

		if (mode === "text" && searchText.length < 3) {
			setLoading(false);
			setLoadingMore(false);
			return;
		}

		if (page === 1) {
			setLoading(true);
		} else {
			setLoadingMore(true);
		}

		const request = {
			op: "guestGetStroka",
			mode,
			page,
            commercial: commercialOnly ? 1 : 0,
		};

		if (mode === "date") {
			request.date = date;
		}

		if (mode === "text") {
			request.text = searchText;
		}

		sendDataToServer(request)
			.then((data) => {
				if (!active) {
					return;
				}

				if (data?.status !== "OK") {
					return;
				}

				const newItems = data.items || [];

				setItems((prev) => {
					if (page === 1) {
						return newItems;
					}

					return [...prev, ...newItems];
				});

				setPages(data.pages || 0);
				setTotal(data.total || 0);
			})
			.finally(() => {
				if (!active) {
					return;
				}

				setLoading(false);
				setLoadingMore(false);
			});

		return () => {
			active = false;
		};
	}, [mode, date, searchText, page, commercialOnly]);

	useEffect(() => {
		const node = loadMoreRef.current;

		if (!node) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];

				if (
					entry.isIntersecting &&
					!loading &&
					!loadingMore &&
					page < pages
				) {
					setPage((prev) => prev + 1);
				}
			},
			{
				root: null,
				rootMargin: "300px",
				threshold: 0,
			}
		);

		observer.observe(node);

		return () => {
			observer.disconnect();
		};
	}, [loading, loadingMore, page, pages]);

	const handleModeChange = (e) => {
		const value = e.target.value;

		setMode(value);

		if (value === "text") {
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 0);
		}
	};

	return (
		<Container maxWidth="lg" sx={{ py: 3 }}>




<Box
	sx={{
		display: "grid",
		gridTemplateColumns: {
			xs: "1fr",
			md: "1fr auto 1fr",
		},
		alignItems: "center",
		gap: {
			xs: 2,
			md: 3,
		},
		mb: 3,
	}}
>
	<Box>
		<Typography
			variant="h4"
			sx={{
				fontSize: {
					xs: "1.7rem",
					sm: "2rem",
				},
			}}
		>
			Объявления
		</Typography>

		{total > 0 && (
			<Typography
				variant="body2"
				color="text.secondary"
			>
				Найдено: {total}
			</Typography>
		)}
	</Box>

	<Box
		sx={{
			display: "flex",
			justifyContent: {
				xs: "flex-start",
				md: "center",
			},
		}}
	>
		<FormControlLabel
			control={
				<Checkbox
					size="small"
					checked={commercialOnly}
					onChange={(e) =>
						setCommercialOnly(e.target.checked)
					}
				/>
			}
			label="Только коммерческие"
			sx={{
				m: 0,
				"& .MuiFormControlLabel-label": {
					fontSize: 13,
				},
			}}
		/>
	</Box>

	<Box
		sx={{
			display: "flex",
			flexDirection: {
				xs: "column",
				sm: "row",
			},
			justifyContent: {
				xs: "flex-start",
				md: "flex-end",
			},
			alignItems: {
				xs: "stretch",
				sm: "center",
			},
			gap: 1,
			width: "100%",
		}}
	>
		<FormControl
			size="small"
			sx={{
				width: {
					xs: "100%",
					sm: 180,
				},
			}}
		>
			<InputLabel>
				Поиск
			</InputLabel>

			<Select
				value={mode}
				label="Поиск"
				onChange={handleModeChange}
			>
				<MenuItem value="date">
					По дате
				</MenuItem>

				<MenuItem value="text">
					По содержимому
				</MenuItem>
			</Select>
		</FormControl>

		{mode === "date" && (
			<Box
				sx={{
					position: "relative",
					width: {
						xs: "100%",
						sm: 180,
					},
				}}
			>
				<TextField
				type="date"
				size="small"
				value={date}
				onChange={(e) => {
					const value = e.target.value;
					const today = getToday();

					setDate(value > today ? today : value);
				}}
				fullWidth
				slotProps={{
					htmlInput: {
					max: getToday(),
					},
				}}
				sx={(theme) => ({
					"& input": {
					colorScheme: theme.palette.mode,
					pr: 4,
					},

					"& input::-webkit-calendar-picker-indicator": {
					opacity: 0,
					position: "absolute",
					right: 0,
					width: 40,
					height: "100%",
					cursor: "pointer",
					},
				})}
				/>

				<CalendarMonthIcon
					sx={{
						position: "absolute",
						right: 12,
						top: "50%",
						transform: "translateY(-50%)",
						fontSize: 18,
						color: "text.secondary",
						pointerEvents: "none",
					}}
				/>
			</Box>
		)}

		{mode === "text" && (
			<TextField
				size="small"
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Введите текст..."
				inputRef={searchInputRef}
				sx={{
					width: {
						xs: "100%",
						sm: 300,
					},
				}}
			/>
		)}
	</Box>
</Box>



			{loading ? (
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: 300,
					}}
				>
					<CircularProgress />
				</Box>
			) : mode === "text" && searchText.length < 2 ? (
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: 200,
					}}
				>
					<Typography color="text.secondary">
						Введите минимум 3 символа
					</Typography>
				</Box>
			) : items.length === 0 ? (
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: 200,
					}}
				>
					<Typography color="text.secondary">
						Объявления не найдены
					</Typography>
				</Box>
			) : (
				<>
					<Stack spacing={2}>
                        {items.map((item, index) => (
							<Card
								key={item.id}
								variant="outlined"
								sx={{
									position: "relative",
									overflow: "visible",
								}}
							>
								{item.beznal === 1 && (
									<Box
										sx={{
											position: "absolute",
											top: 5,
											left: 16,
											transform: "translateY(-10%)",
											px: 0.5,
											display: "flex",
											alignItems: "center",
											gap: 0.5,
										}}
									>
										<BusinessIcon
											sx={{
												fontSize: 16,
												color: "text.secondary",
											}}
										/>

										<Typography
											variant="caption"
											sx={{
												fontWeight: 600,
												color: "text.secondary",
											}}
										>
											ЮРЛИЦО
										</Typography>
									</Box>
								)}

								{item.period && (
									<Box
										sx={{
											position: "absolute",
											top: 5,
											right: 16,
											transform: "translateY(-10%)",
											px: 0.5,
										}}
									>
										<Typography
											variant="caption"
											color="text.secondary"
										>
											{item.period}
										</Typography>
									</Box>
								)}

								<CardContent>
									<Typography
										variant="h6"
										sx={{
											mt: 1,
											pt:1,
											whiteSpace: "pre-line",
										}}
									>
										{linkifyPhones(item.text, mode === "text" ? searchText : "")}
									</Typography>
								</CardContent>
							</Card>
                        ))}
					</Stack>

                    <Box
                        ref={loadMoreRef}
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            minHeight: 100,
                        }}
                    >
                        {loadingMore ? (
                            <CircularProgress size={28} />
                        ) : page >= pages && items.length > 0 ? (
                            <Button
                                component={Link}
                                to="/add"
                                variant="contained"
                                size="large"
                                startIcon={ <AddCircleOutlineIcon />}
                            >
                                Добавить объявление
                            </Button>
                        ) : null}
                    </Box>
				</>
			)}
		</Container>
	);
}