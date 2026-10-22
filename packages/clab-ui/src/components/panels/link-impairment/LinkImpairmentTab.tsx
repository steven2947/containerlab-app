import { uiText } from "../../../i18n";
import type React from "react";
import Box from "@mui/material/Box";

import { InputField, PanelSection } from "../../ui/form";

import type { NetemState } from "./types";

export interface LinkImpairmentTabProps {
  data: NetemState;
  onChange: (updates: Partial<NetemState>) => void;
}

export const LinkImpairmentTab: React.FC<LinkImpairmentTabProps> = ({ data, onChange }) => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <PanelSection title={uiText("Impairment Settings")}>
        <InputField
          id="delay"
          label={uiText("Delay")}
          value={data.delay ?? ""}
          onChange={(value) => onChange({ delay: value })}
          placeholder={uiText("Delay (with units). i.e. 50ms, 5s")}
        />
        <InputField
          id="jitter"
          label={uiText("Jitter")}
          value={data.jitter ?? ""}
          onChange={(value) => onChange({ jitter: value })}
          placeholder={uiText("Jitter (with units). i.e. 10ms, 500ms")}
        />
        <InputField
          id="loss"
          label={uiText("Loss")}
          value={data.loss ?? ""}
          onChange={(value) => onChange({ loss: value })}
          placeholder={uiText("Loss in percent. i.e. 5, 0.1")}
        />
        <InputField
          id="rate"
          label={uiText("Rate Limit")}
          value={data.rate ?? ""}
          onChange={(value) => onChange({ rate: value })}
          placeholder={uiText("Rate in kbps. i.e. 1000, 10000")}
        />
        <InputField
          id="corruption"
          label={uiText("Corruption")}
          value={data.corruption ?? ""}
          onChange={(value) => onChange({ corruption: value })}
          placeholder={uiText("Corruption in percent. i.e. 5, 0.1")}
        />
      </PanelSection>
    </Box>
  );
};
