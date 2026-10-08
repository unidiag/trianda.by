import React from "react";
import { Box, Typography } from "@mui/material";
import { Link } from "react-router-dom";

export default function Logo() {
    return (
        <Box
            component={Link}
            to="/"
            sx={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                lineHeight: 1,
                color: "inherit",
                textDecoration: "none",
                cursor: "pointer",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    fontSize: 42,
                    fontWeight: 700,
                    lineHeight: 1,
                }}
            >
                <Box component="span">
                    Три
                </Box>

                <Box
                    component="img"
                    src="/sources/logo.png"
                    alt=""
                    sx={{
                        height: 42,
                        width: "auto",
                        mx: 0.3,
                    }}
                />

                <Box component="span">
                    нда
                </Box>
            </Box>

            <Typography
                sx={{
                    mt: 0.5,
                    fontSize: 15,
                    letterSpacing: 1.5,
                    textTransform: "lowercase"
                }}
            >
                городское телевидение
            </Typography>
        </Box>
    );
}
