import { uiText } from "../../i18n";
import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  TextField,
  Typography
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { DialogTitleWithClose } from "../../components/ui/dialog/DialogChrome";
import { importCustomThemes, type CustomTheme } from "../../theme/customThemes";
import { MONO_FONT_FAMILY } from "../../theme/typography";
import { pickJsonFile } from "../../utils/jsonFile";

const PLACEHOLDER = `{
  "name": "My theme",
  "type": "dark",
  "colors": {
    "editor.background": "#1e1e2e",
    "button.background": "#cba6f7"
  }
}`;

/** Imports themes exported by this app or VS Code color themes, from a file or pasted JSON. */
export function ThemeImportDialog({
  open,
  onClose,
  onImport
}: {
  open: boolean;
  onClose: () => void;
  onImport: (themes: CustomTheme[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setText("");
    setError(null);
    onClose();
  };
  const importText = (content: string) => {
    try {
      onImport(importCustomThemes(content));
      close();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    }
  };
  const importFile = async () => {
    const file = await pickJsonFile();
    if (file) importText(await file.text());
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="sm"
      fullWidth
      data-testid="theme-import-dialog"
    >
      <DialogTitleWithClose title={uiText("Import themes")} onClose={close} />
      <DialogContent sx={{ display: "grid", gap: 2 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>{uiText("Use a theme exported from this app, or a VS Code color theme. Theme extensions keep those as JSON files in their ")}<code>{uiText("themes")}</code>{uiText(" folder. Colors a VS Code theme leaves out are derived from the ones it sets.")}</Typography>
        <Box>
          <Button variant="outlined" size="small" startIcon={<UploadFileIcon />} onClick={() => void importFile()}>{uiText("Choose file…")}</Button>
        </Box>
        <Divider sx={{ typography: "caption", color: "text.secondary" }}>{uiText("or paste JSON")}</Divider>
        <TextField
          multiline
          minRows={8}
          maxRows={16}
          fullWidth
          value={text}
          placeholder={PLACEHOLDER}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          slotProps={{ htmlInput: { "aria-label": uiText("Theme JSON"), spellCheck: false } }}
          sx={{
            "& textarea": { fontFamily: MONO_FONT_FAMILY, fontSize: 12 }
          }}
        />
        {error === null ? null : <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={close}>{uiText("Cancel")}</Button>
        <Button disabled={!text.trim()} onClick={() => importText(text)} data-testid="theme-import-submit">{uiText("Import")}</Button>
      </DialogActions>
    </Dialog>
  );
}
