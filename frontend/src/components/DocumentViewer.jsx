import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";

export default function DocumentViewer({
  open,
  onClose,
  title,
  src,
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
    }
  }, [open, src]);

  const isPdf = src?.toLowerCase().endsWith(".pdf");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: {
            xs: "90dvh",
            sm: "85dvh",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          pr: 6,
        }}
      >
        {title}

        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          position: "relative",
          p: 0,
          overflow: "hidden",
        }}
      >
        {loading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              bgcolor: "background.paper",
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {isPdf ? (
          <Box
            component="iframe"
            src={src}
            title={title}
            onLoad={() => setLoading(false)}
            sx={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
            }}
          >
            <Box
              component="img"
              src={src}
              alt={title}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}