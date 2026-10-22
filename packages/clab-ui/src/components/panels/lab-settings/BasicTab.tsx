import { uiText } from "../../../i18n";
// General settings tab for lab settings.
import React from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import { SettingsField } from "../../../settings/SettingsField";

import type { BasicSettingsSetters, BasicSettingsState, PrefixType } from "./types";

interface BasicTabProps {
  basic: BasicSettingsState;
  setBasic: BasicSettingsSetters;
  isViewMode: boolean;
}

export const BasicTab: React.FC<BasicTabProps> = ({ basic, setBasic, isViewMode }) => (
  <>
    <SettingsField title={uiText("Lab Name")} description={uiText("Unique name for this topology.")}>
      <TextField
        slotProps={{ htmlInput: { "aria-label": uiText("Lab Name") } }}
        id="lab-basic-name"
        size="small"
        placeholder={uiText("Unique name for this topology")}
        value={basic.labName}
        onChange={(event) => setBasic.setLabName(event.target.value)}
        disabled={isViewMode}
      />
    </SettingsField>
    <SettingsField title={uiText("Container Name Prefix")} description={uiText("Prefix applied to deployed container names.")}>
      <TextField
        slotProps={{ select: { inputProps: { "aria-label": uiText("Container Name Prefix") } } }}
        id="lab-basic-prefix-type"
        select
        size="small"
        value={basic.prefixType}
        onChange={(event) => setBasic.setPrefixType(event.target.value as PrefixType)}
        disabled={isViewMode}
      >
        <MenuItem value="default">{uiText("Default (clab)")}</MenuItem>
        <MenuItem value="custom">{uiText("Custom")}</MenuItem>
        <MenuItem value="no-prefix">{uiText("No prefix")}</MenuItem>
      </TextField>
    </SettingsField>
    {basic.prefixType === "custom" ? (
      <SettingsField title={uiText("Custom Prefix")} description={uiText("Used instead of the default clab prefix.")}>
        <TextField
          slotProps={{ htmlInput: { "aria-label": uiText("Custom Prefix") } }}
          id="lab-basic-custom-prefix"
          size="small"
          placeholder={uiText("Enter custom prefix")}
          value={basic.customPrefix}
          onChange={(event) => setBasic.setCustomPrefix(event.target.value)}
          disabled={isViewMode}
        />
      </SettingsField>
    ) : null}
  </>
);
