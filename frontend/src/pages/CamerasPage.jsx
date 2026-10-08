import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Typography,
} from "@mui/material";

import CameraAltIcon from "@mui/icons-material/CameraAlt";
import VideocamIcon from "@mui/icons-material/Videocam";
import DownloadIcon from "@mui/icons-material/Download";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";

import { useTheme } from "@mui/material/styles";

import { sendDataToServer } from "utils/functions";
import { useToast } from "utils/useToast";

import SubscriberAccessDialog, {
  loadSubscriberAccess,
} from "../components/SubscriberAccessDialog";


const SUBSCRIBER_STORAGE_KEY =
  "checkSubscriber";


function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(
    `${value}T12:00:00`
  );

  return date.toLocaleDateString(
    "ru-RU",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}


function getTimelineMax(
  selectedDate
) {
  if (!selectedDate) {
    return 86399;
  }

  const now = new Date();

  const today =
    `${now.getFullYear()}-` +
    `${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-` +
    `${String(
      now.getDate()
    ).padStart(2, "0")}`;

  if (
    selectedDate !== today
  ) {
    return 86399;
  }

  return (
    now.getHours() * 3600 +
    now.getMinutes() * 60 +
    now.getSeconds()
  );
}


function previewUrl(
  cam,
  unix
) {
  const baseUrl =
    process.env.REACT_APP_URL ||
    "";

  return (
    `${baseUrl}/camera/preview` +
    `?cam=${encodeURIComponent(
      cam
    )}` +
    `&t=${unix}`
  );
}


function formatTime(unix) {
  if (!unix) {
    return "";
  }

  return new Date(
    unix * 1000
  ).toLocaleTimeString(
    "ru-RU",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}


function secondsFromMidnight(
  unix
) {
  const date = new Date(
    unix * 1000
  );

  return (
    date.getHours() * 3600 +
    date.getMinutes() * 60 +
    date.getSeconds()
  );
}


function secondsToTime(
  seconds
) {
  const h = Math.floor(
    seconds / 3600
  );

  const m = Math.floor(
    (seconds % 3600) / 60
  );

  return (
    `${String(h).padStart(
      2,
      "0"
    )}:` +
    `${String(m).padStart(
      2,
      "0"
    )}`
  );
}


function findNearestFrame(
  frames,
  seconds
) {
  if (
    !Array.isArray(frames) ||
    frames.length === 0
  ) {
    return 0;
  }

  let best = frames[0];

  let bestDiff = Math.abs(
    secondsFromMidnight(best) -
      seconds
  );

  for (
    let i = 1;
    i < frames.length;
    i++
  ) {
    const frame = frames[i];

    const diff = Math.abs(
      secondsFromMidnight(
        frame
      ) - seconds
    );

    if (diff < bestDiff) {
      best = frame;
      bestDiff = diff;
    }
  }

  return best;
}


export default function CamerasPage() {
  const theme = useTheme();
  const toast = useToast();

  const [date, setDate] =
    useState("");

  const [dates, setDates] =
    useState([]);

  const [cameras, setCameras] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    selectedCamera,
    setSelectedCamera,
  ] = useState(null);

  const [
    selectedFrame,
    setSelectedFrame,
  ] = useState(0);

  const [
    timelineValue,
    setTimelineValue,
  ] = useState(0);

  const [
    subscriberDialogOpen,
    setSubscriberDialogOpen,
  ] = useState(false);

  const [
    pendingArchiveAction,
    setPendingArchiveAction,
  ] = useState(null);

  const [
    subscriberChecking,
    setSubscriberChecking,
  ] = useState(false);


  const timelineMax =
    getTimelineMax(date);


  const selectedCameraData =
    useMemo(
      () =>
        cameras.find(
          (camera) =>
            camera.id ===
            selectedCamera
        ) || null,
      [
        cameras,
        selectedCamera,
      ]
    );


  const downloadSelectedChunk = () => {
    if (
      !selectedCameraData ||
      !selectedFrame
    ) {
      return;
    }

    const subscriber =
      loadSubscriberAccess();

    if (
      !subscriber ||
      !subscriber.personal ||
      !subscriber.surname
    ) {
      return;
    }

    const baseUrl =
      process.env.REACT_APP_URL || "";

    window.location.href =
      `${baseUrl}/camera/download` +
      `?cam=${encodeURIComponent(
        selectedCameraData.id
      )}` +
      `&files=${selectedFrame}` +
      `&personal=${encodeURIComponent(
        subscriber.personal
      )}` +
      `&surname=${encodeURIComponent(
        subscriber.surname
      )}`;
  };


  /*
   * Проверка доступа к архиву.
   *
   * localStorage используется только
   * для получения лицевого счёта
   * и фамилии.
   *
   * Пакет и задолженность каждый раз
   * запрашиваем заново с backend.
   */
  const runArchiveAction =
    async (action) => {
      if (
        subscriberChecking
      ) {
        return;
      }

      const subscriber =
        loadSubscriberAccess();

      /*
       * Если данных ещё нет —
       * показываем форму.
       */
      if (
        !subscriber ||
        !subscriber.personal?.trim() ||
        !subscriber.surname?.trim()
      ) {
        setPendingArchiveAction(
          () => action
        );

        setSubscriberDialogOpen(
          true
        );

        return;
      }

      setSubscriberChecking(true);

      try {
        const personal =
          subscriber.personal.trim();

        const surname =
          subscriber.surname.trim();

        /*
         * Получаем свежие данные
         * с backend.
         */
        const data =
          await sendDataToServer({
            op: "guestCheckBalance",
            personal,
            surname,
          });

        if (!data) {
          toast.error(
            "Не удалось проверить данные абонента"
          );

          return;
        }

        if (
          data.status !== "OK"
        ) {
          toast.error(
            data.error ||
              "Не удалось проверить данные абонента"
          );

          return;
        }

        /*
         * Сохранённые реквизиты
         * больше не проходят проверку.
         */
        if (!data.found) {
          localStorage.removeItem(
            SUBSCRIBER_STORAGE_KEY
          );

          setPendingArchiveAction(
            () => action
          );

          setSubscriberDialogOpen(
            true
          );

          toast.error(
            "Необходимо повторно подтвердить данные абонента"
          );

          return;
        }

        const actualSubscriber = {
          personal,
          surname,

          tarif:
            data.tarif || "",

          amount:
            Number(
              data.amount
            ) || 0,
        };

        /*
         * Обновляем сохранённую
         * информацию свежими данными.
         */
        localStorage.setItem(
          SUBSCRIBER_STORAGE_KEY,
          JSON.stringify(
            actualSubscriber
          )
        );

        /*
         * Проверяем пакет.
         */
        if (
          actualSubscriber.tarif !==
          "Цифровой пакет"
        ) {
          toast.error(
            "Сервис архива камер доступен только абонентам цифрового пакета"
          );

          return;
        }

        /*
         * Проверяем задолженность.
         */
        if (
          actualSubscriber.amount >
          30
        ) {
          toast.error(
            "Для доступа к архиву камер задолженность абонента не должна превышать 30 рублей"
          );

          return;
        }

        /*
         * Проверка успешно пройдена.
         */
        action();
      } catch (e) {
        console.error(e);

        toast.error(
          "Не удалось проверить данные абонента"
        );
      } finally {
        setSubscriberChecking(
          false
        );
      }
    };


  /*
   * Пользователь заполнил форму
   * SubscriberAccessDialog.
   *
   * Сам Dialog только что выполнил
   * guestCheckBalance, поэтому можно
   * сразу выполнить ожидающее действие.
   */
  const handleSubscriberAccessSuccess =
    () => {
      if (
        pendingArchiveAction
      ) {
        pendingArchiveAction();
      }

      setPendingArchiveAction(
        null
      );
    };


  const loadCameras = async (
    requestedDate = ""
  ) => {
    setLoading(true);
    setError("");

    try {
      const response =
        await sendDataToServer({
          op: "guestGetCameras",
          date: requestedDate,
        });

      if (
        !response ||
        response.status !== "OK"
      ) {
        setError(
          response?.error ||
            "Не удалось получить архив камер"
        );

        setDates([]);
        setCameras([]);

        return;
      }

      setDate(
        response.date || ""
      );

      setDates(
        Array.isArray(
          response.dates
        )
          ? response.dates
          : []
      );

      const loadedCameras =
        Array.isArray(
          response.cameras
        )
          ? response.cameras
          : [];

      setCameras(
        loadedCameras
      );

      /*
       * Поддержка прямой ссылки:
       *
       * /cameras#cam1
       */
      const hashCamera =
        window.location.hash.replace(
          "#",
          ""
        );

      const cameraFromHash =
        loadedCameras.find(
          (camera) =>
            camera.id ===
            hashCamera
        );

      if (cameraFromHash) {
        setSelectedCamera(
          cameraFromHash.id
        );

        const frames =
          Array.isArray(
            cameraFromHash.frames
          )
            ? cameraFromHash.frames
            : [];

        let frame =
          cameraFromHash.preview ||
          0;

        if (
          !frame &&
          frames.length > 0
        ) {
          frame =
            frames[
              frames.length - 1
            ];
        }

        setSelectedFrame(
          frame
        );

        setTimelineValue(
          frame
            ? secondsFromMidnight(
                frame
              )
            : 0
        );
      } else {
        setSelectedCamera(
          null
        );

        setSelectedFrame(0);
        setTimelineValue(0);
      }
    } catch (e) {
      console.error(e);

      setError(
        "Ошибка загрузки архива камер"
      );

      setDates([]);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  };



  const playSelectedChunk = async () => {
    if (
      !selectedCameraData ||
      !selectedFrame
    ) {
      return;
    }

    const subscriber =
      loadSubscriberAccess();

    if (
      !subscriber?.personal ||
      !subscriber?.surname
    ) {
      toast.error(
        "Не удалось определить данные абонента"
      );

      return;
    }

    try {
      const response =
        await sendDataToServer({
          op: "guestPlayCamera",

          cam:
            selectedCameraData.id,

          time:
            String(
              selectedFrame
            ),

          personal:
            subscriber.personal,

          surname:
            subscriber.surname,
        });

      if (
        !response ||
        response.status !== "OK"
      ) {
        toast.error(
          response?.error ||
            "Не удалось запустить воспроизведение"
        );

        return;
      }

      toast.success(
        "Воспроизведение архива запущено на 100-м телеканале"
      );
    } catch (e) {
      console.error(e);

      toast.error(
        "Не удалось запустить воспроизведение"
      );
    }
  };  


  useEffect(() => {
    loadCameras();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const changeDate = (
    value
  ) => {
    setDate(value);

    loadCameras(
      value
    );
  };


  const openCamera = (
    camera
  ) => {
    setSelectedCamera(
      camera.id
    );

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}` +
        `${window.location.search}` +
        `#${camera.id}`
    );

    const frames =
      Array.isArray(
        camera.frames
      )
        ? camera.frames
        : [];

    let frame =
      camera.preview || 0;

    if (
      !frame &&
      frames.length > 0
    ) {
      frame =
        frames[
          frames.length - 1
        ];
    }

    setSelectedFrame(
      frame
    );

    setTimelineValue(
      frame
        ? secondsFromMidnight(
            frame
          )
        : 0
    );
  };


  const closeCamera = () => {
    setSelectedCamera(null);
    setSelectedFrame(0);
    setTimelineValue(0);

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}` +
        `${window.location.search}`
    );
  };


  const changeTimeline = (
    event,
    value
  ) => {
    const seconds =
      Number(value);

    /*
     * Шкала всегда показывает
     * полные сутки, но сегодня
     * нельзя выбрать будущее время.
     */
    if (
      seconds > timelineMax
    ) {
      return;
    }

    setTimelineValue(
      seconds
    );

    if (
      !selectedCameraData
    ) {
      return;
    }

    const frame =
      findNearestFrame(
        selectedCameraData.frames,
        seconds
      );

    setSelectedFrame(
      frame
    );
  };


  const timelineMarks = [
    {
      value: 0,
      label: "00:00",
    },
    {
      value: 6 * 3600,
      label: "06:00",
    },
    {
      value: 12 * 3600,
      label: "12:00",
    },
    {
      value: 18 * 3600,
      label: "18:00",
    },
    {
      value: 86399,
      label: "23:59",
    },
  ];


  return (
    <Container
      maxWidth={
        selectedCamera
          ? false
          : "lg"
      }
      sx={{
        py: {
          xs: 3,
          sm: 5,
        },

        px: selectedCamera
          ? {
              xs: 2,
              sm: 3,
            }
          : undefined,
      }}
    >
      {/*
       * Заголовок слева,
       * выбор даты справа.
       */}
      <Box
        sx={{
          display: "flex",

          alignItems: {
            xs: "stretch",
            sm: "center",
          },

          justifyContent:
            "space-between",

          flexDirection: {
            xs: "column",
            sm: "row",
          },

          gap: 2,
          mb: 4,
        }}
      >


      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <CameraAltIcon
          color="primary"
        />

        <FormControl
          size="small"
          sx={{
            width: {
              xs: "100%",
              sm: 320,
            },
          }}
        >
          <InputLabel>
            Камера
          </InputLabel>


          <Select
            value={
              selectedCamera || "all"
            }
            label="Камера"
            onChange={(event) => {
              const value =
                event.target.value;

              if (value === "all") {
                closeCamera();
                return;
              }

              const camera =
                cameras.find(
                  (item) =>
                    item.id === value
                );

              if (camera) {
                openCamera(camera);
              }
            }}
          >
            <MenuItem value="all">
              Все камеры
            </MenuItem>

            {cameras.map(
              (camera) => (
                <MenuItem
                  key={camera.id}
                  value={camera.id}
                >
                  {camera.name}
                </MenuItem>
              )
            )}
          </Select>


        </FormControl>
      </Box>


        <FormControl
          size="small"
          sx={{
            width: {
              xs: "100%",
              sm: 320,
            },

            flexShrink: 0,
          }}
        >
          <InputLabel>
            Дата
          </InputLabel>

          <Select
            value={date}
            label="Дата"
            onChange={(
              event
            ) =>
              changeDate(
                event.target.value
              )
            }
          >
            {dates.map(
              (item) => (
                <MenuItem
                  key={item}
                  value={item}
                >
                  {formatDate(
                    item
                  )}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>
      </Box>


      {error && (
        <Typography
          color="error"
          sx={{
            textAlign:
              "center",
            mb: 3,
          }}
        >
          {error}
        </Typography>
      )}


      {loading ? (
        <Box
          sx={{
            py: 10,
            display: "flex",
            justifyContent:
              "center",
          }}
        >
          <CircularProgress />
        </Box>
      ) : selectedCameraData ? (
        /*
         * Открытая камера
         */
        <Box
          sx={{
            width: "100%",
          }}
        >


          {/*
           * Большой скриншот.
           */}
          <Paper
            elevation={0}
            sx={{
              position:
                "relative",

              width: "100%",

              overflow:
                "hidden",

              borderRadius: 2,

              border:
                "1px solid",

              borderColor:
                "divider",

              backgroundColor:
                theme.palette
                  .mode ===
                "dark"
                  ? theme
                      .palette
                      .grey[900]
                  : theme
                      .palette
                      .grey[200],

              minHeight: {
                xs: 260,
                sm: 420,
                md: 600,
              },

              display: "flex",

              alignItems:
                "center",

              justifyContent:
                "center",
            }}
          >
            {selectedFrame >
            0 ? (
              <Box
                component="img"
                src={previewUrl(
                  selectedCameraData.id,
                  selectedFrame
                )}
                alt={
                  selectedCameraData.name
                }
                sx={{
                  display:
                    "block",

                  width:
                    "100%",

                  maxHeight:
                    "75vh",

                  objectFit:
                    "contain",

                  backgroundColor:
                    "black",
                }}
              />
            ) : (
              <VideocamIcon
                sx={{
                  fontSize: {
                    xs: 80,
                    sm: 120,
                  },

                  color:
                    theme
                      .palette
                      .mode ===
                    "dark"
                      ? theme
                          .palette
                          .grey[700]
                      : theme
                          .palette
                          .grey[400],
                }}
              />
            )}


            {/*
             * Время кадра:
             * справа сверху.
             */}
            {selectedFrame >
              0 && (
              <Box
                sx={{
                  position:
                    "absolute",

                  top: 16,
                  right: 16,

                  px: 1.75,
                  py: 0.75,

                  borderRadius:
                    1.5,

                  backgroundColor:
                    "rgba(0,0,0,0.72)",

                  zIndex: 2,
                }}
              >
                <Typography
                  sx={{
                    color:
                      "white",

                    fontWeight:
                      700,

                    fontFamily:
                      "monospace",

                    fontSize: {
                      xs:
                        "1.4rem",

                      sm:
                        "1.8rem",

                      md:
                        "2.2rem",
                    },

                    lineHeight: 1,
                  }}
                >
                  {formatTime(
                    selectedFrame
                  )}
                </Typography>
              </Box>
            )}


            {/*
             * Кнопки поверх нижней
             * части скриншота.
             */}
            <Box
              sx={{
                position:
                  "absolute",

                left: 0,
                right: 0,
                bottom: 0,

                zIndex: 2,

                display: "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                gap: 2,

                px: 2,
                py: 2,

                background:
                  "linear-gradient(transparent, rgba(0,0,0,0.82))",
              }}
            >
              <Button
                variant="outlined"

                startIcon={
                  subscriberChecking ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                    />
                  ) : (
                    <DownloadIcon />
                  )
                }

                disabled={
                  !selectedFrame ||
                  subscriberChecking
                }

                onClick={() => {
                  runArchiveAction(
                    downloadSelectedChunk
                  );
                }}

                sx={{
                  color:
                    "white",

                  borderColor:
                    "rgba(255,255,255,0.5)",

                  backgroundColor:
                    "rgba(0,0,0,0.25)",

                  "&:hover": {
                    borderColor:
                      "white",

                    backgroundColor:
                      "rgba(255,255,255,0.08)",
                  },
                }}
              >
                Скачать
              </Button>


              <Button
                variant="contained"
                startIcon={
                  <PlayCircleOutlineIcon />
                }
                disabled={
                  !selectedFrame ||
                  subscriberChecking
                }
                onClick={() => {
                  runArchiveAction(
                    playSelectedChunk
                  );
                }}
              >
                Воспроизвести
              </Button>
            </Box>
          </Paper>


          {/*
           * Timeline.
           */}
          <Paper
            elevation={0}
            sx={{
              mt: 2,

              px: {
                xs: 2,
                sm: 4,
              },

              pt: 3,
              pb: 2,

              border:
                "1px solid",

              borderColor:
                "divider",

              borderRadius: 2,
            }}
          >
            <Box
              sx={{
                position:
                  "relative",

                mt: 1,
                mb: 2,
              }}
            >
              <Slider
                value={
                  timelineValue
                }

                min={0}
                max={86399}
                step={1}

                marks={
                  timelineMarks
                }

                onChange={
                  changeTimeline
                }

                valueLabelDisplay="auto"

                valueLabelFormat={(
                  value
                ) =>
                  secondsToTime(
                    value
                  )
                }

                sx={{
                  position:
                    "relative",

                  zIndex: 2,

                  "& .MuiSlider-markLabel":
                    {
                      fontSize:
                        "0.75rem",
                    },

                  "& .MuiSlider-rail":
                    {
                      zIndex: 1,
                    },

                  "& .MuiSlider-track":
                    {
                      zIndex: 2,
                    },

                  "& .MuiSlider-thumb":
                    {
                      zIndex: 4,
                    },
                }}
              />


              {/*
               * Штрихи реально
               * существующих кадров.
               *
               * Они расположены
               * немного ВЫШЕ линии.
               */}
              <Box
                sx={{
                  position:
                    "absolute",

                  top: "50%",
                  left: 0,
                  right: 0,

                  height: 12,

                  transform:
                    "translateY(-20px)",

                  pointerEvents:
                    "none",

                  zIndex: 3,
                }}
              >
                {Array.isArray(
                  selectedCameraData.frames
                ) &&
                  selectedCameraData.frames.map(
                    (frame) => {
                      const seconds =
                        secondsFromMidnight(
                          frame
                        );

                      const left =
                        (
                          seconds /
                          86399
                        ) *
                        100;

                      return (
                        <Box
                          key={
                            frame
                          }
                          sx={{
                            position:
                              "absolute",

                            left:
                              `${left}%`,

                            top:
                              "50%",

                            width: 2,
                            height: 10,

                            transform:
                              "translate(-1px, -50%)",

                            borderRadius:
                              1,

                            backgroundColor:
                              theme
                                .palette
                                .mode ===
                              "dark"
                                ? "rgba(255,255,255,0.55)"
                                : "rgba(0,0,0,0.45)",
                          }}
                        />
                      );
                    }
                  )}
              </Box>
            </Box>
          </Paper>
        </Box>
      ) : (
        /*
         * Список камер.
         */
        <Box
          sx={{
            display: "grid",

            gridTemplateColumns: {
              xs: "1fr",

              sm:
                "repeat(2, minmax(0, 1fr))",

              md:
                "repeat(3, minmax(0, 1fr))",
            },

            gap: 2,
          }}
        >
          {cameras.map(
            (camera) => (
              <Paper
                key={
                  camera.id
                }

                elevation={0}

                onClick={() =>
                  openCamera(
                    camera
                  )
                }

                sx={{
                  position:
                    "relative",

                  overflow:
                    "hidden",

                  borderRadius: 2,

                  border:
                    "1px solid",

                  borderColor:
                    "divider",

                  aspectRatio:
                    "3 / 2",

                  backgroundColor:
                    theme.palette
                      .mode ===
                    "dark"
                      ? theme
                          .palette
                          .grey[900]
                      : theme
                          .palette
                          .grey[200],

                  backgroundImage:
                    camera.preview
                      ? `url("${previewUrl(
                          camera.id,
                          camera.preview
                        )}")`
                      : "none",

                  backgroundSize:
                    "cover",

                  backgroundPosition:
                    "center",

                  display:
                    "flex",

                  alignItems:
                    "flex-end",

                  cursor:
                    "pointer",

                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",

                  "&:hover": {
                    transform:
                      "translateY(-3px)",

                    boxShadow:
                      theme
                        .shadows[6],
                  },
                }}
              >
                {!camera.preview && (
                  <Box
                    sx={{
                      position:
                        "absolute",

                      inset: 0,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",
                    }}
                  >
                    <VideocamIcon
                      sx={{
                        fontSize: {
                          xs: 64,
                          sm: 72,
                        },

                        color:
                          theme
                            .palette
                            .mode ===
                          "dark"
                            ? theme
                                .palette
                                .grey[700]
                            : theme
                                .palette
                                .grey[400],
                      }}
                    />
                  </Box>
                )}


                <Box
                  sx={{
                    position:
                      "relative",

                    zIndex: 1,

                    width:
                      "100%",

                    px: 2,
                    py: 1.5,

                    background:
                      "linear-gradient(transparent, rgba(0,0,0,0.85))",
                  }}
                >
                  <Typography
                    sx={{
                      color:
                        "white",

                      fontWeight:
                        700,

                      fontSize:
                        "1.1rem",
                    }}
                  >
                    {
                      camera.name
                    }
                  </Typography>


                  {camera.preview >
                    0 && (
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          "rgba(255,255,255,0.75)",
                      }}
                    >
                      {formatTime(
                        camera.preview
                      )}
                    </Typography>
                  )}
                </Box>
              </Paper>
            )
          )}
        </Box>
      )}


      <SubscriberAccessDialog
        open={
          subscriberDialogOpen
        }

        onClose={() => {
          setSubscriberDialogOpen(
            false
          );

          setPendingArchiveAction(
            null
          );
        }}

        onSuccess={
          handleSubscriberAccessSuccess
        }
      />
    </Container>
  );
}