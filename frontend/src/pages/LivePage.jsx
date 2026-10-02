import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Box,
  Button,
  Tooltip,
} from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { Link } from "react-router-dom";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";


export default function LivePage() {
  const videoRef = useRef(null);

  const [viewers, setViewers] = useState({
    count: 0,
    viewers: [],
  });

  useEffect(() => {
    const loadViewers = async () => {
      try {
        const response = await fetch(
          process.env.REACT_APP_URL + "/live/viewers"
        );

        const data = await response.json();

        setViewers({
            count: data?.count || 0,
            viewers: Array.isArray(data?.viewers) ? data.viewers : [],
        });
      } catch (e) {
        console.error(e);

        setViewers({
          count: 0,
          ips: [],
        });
      }
    };

    loadViewers();

    const interval = setInterval(loadViewers, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);


    const countryFlag = (country) => {
        if (!country || country.length !== 2) {
            return "🌐";
        }

        return country
            .toUpperCase()
            .replace(/./g, (char) =>
            String.fromCodePoint(127397 + char.charCodeAt())
            );
    };


  useEffect(() => {
    const video = videoRef.current;
    const src = process.env.REACT_APP_URL + "/live/index.m3u8";

    if (!video) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
      };
    }



    
  }, []);

  const fullScreen = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.requestFullscreen) {
      video.requestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  };



  



return (
	<Box
		sx={{
			minHeight: "calc(100vh - 20px)",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			px: 2,
			pt: 3,
			pb: 3,
		}}
	>
		<Box
			sx={{
				width: "100%",
				display: "flex",
				justifyContent: "center",
				mb: 5,
			}}
		>
			<Button
				component={Link}
				to="/add"
				variant="contained"
				size="large"
				startIcon={<AddCircleOutlineIcon />}
				sx={{
					px: 4,
					py: 1.4,
					fontSize: "1.05rem",
					fontWeight: 600,
					textTransform: "none",

					backgroundColor: "#b6ff4a",
					color: "#1a1a1a",

					"&:hover": {
						backgroundColor: "#a6ef3e",
					},

					"& .MuiButton-startIcon svg": {
						fontSize: 24,
					},
				}}
			>
				Добавить объявление
			</Button>
		</Box>

		<Box
			sx={{
				mb: 1.5,
				textAlign: "center",
				fontSize: "0.9rem",
				color: "text.secondary",
			}}
		>
			Сейчас смотрят ({viewers.count})

			{viewers.viewers.length > 0 && (
				<Box
					component="span"
					sx={{
						ml: 1,
						fontSize: "1.25rem",
					}}
				>
					{viewers.viewers.map((viewer, index) => (
						<Tooltip
							key={index}
							title={viewer.agent || "Unknown"}
							arrow
						>
							<Box
								component="span"
								sx={{
									ml: 0.4,
									cursor: "default",
								}}
							>
								{countryFlag(viewer.country)}
							</Box>
						</Tooltip>
					))}
				</Box>
			)}
		</Box>

		<video
			ref={videoRef}
			controls
			autoPlay
			playsInline
			style={{
				width: "100%",
				maxWidth: 1280,
				background: "#000",
			}}
		/>

		<Button
			variant="contained"
			onClick={fullScreen}
			startIcon={<FullscreenIcon />}
			sx={{
				mt: 2,
				textTransform: "none",
			}}
		>
			Полный экран
		</Button>
	</Box>
);

}