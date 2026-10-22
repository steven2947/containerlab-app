import React, { useState } from "react";
import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { getUiLanguage, setUiLanguage, uiText, type UiLanguage } from "../../i18n";
import { SettingsField } from "../../settings/SettingsField";

export function LanguageSetting() {
  const current = getUiLanguage();
  const [language, setLanguage] = useState<UiLanguage>(current);
  return (
    <SettingsField
      title={uiText("Interface language")}
      description={uiText("Reload the interface to apply the language. Running labs and saved connections are preserved.")}
    >
      <Stack direction="row" spacing={1}>
        <TextField
          select size="small" label={uiText("Language")} value={language}
          data-testid="ui-language"
          onChange={(event) => {
            if (event.target.value === "en" || event.target.value === "zh-CN") setLanguage(event.target.value);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="zh-CN">简体中文</MenuItem>
          <MenuItem value="en">English</MenuItem>
        </TextField>
        <Button disabled={language === current} onClick={() => {
          setUiLanguage(language);
          window.location.reload();
        }}>{uiText("Reload to apply")}</Button>
      </Stack>
    </SettingsField>
  );
}
