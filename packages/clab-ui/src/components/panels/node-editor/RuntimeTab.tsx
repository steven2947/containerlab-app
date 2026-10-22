import { uiText } from "../../../i18n";
// Runtime tab for node editor.
import React from "react";
import Box from "@mui/material/Box";

import {
  InputField,
  SelectField,
  CheckboxField,
  DynamicList,
  PanelAddSection,
  PanelSection
} from "../../ui/form";

import type { TabProps } from "./types";
import { withCurrentOption } from "./selectOptions";
import { inheritedFieldHint, inheritedListItems } from "./inheritanceHints";

const RESTART_POLICY_OPTIONS = [
  { value: "", label: uiText("Default") },
  { value: "no", label: uiText("No") },
  { value: "always", label: uiText("Always") },
  { value: "on-failure", label: uiText("On Failure") },
  { value: "unless-stopped", label: uiText("Unless Stopped") }
];

export const RuntimeTab: React.FC<TabProps> = (props) => {
  const { data, onChange } = props;
  const handleAddExec = () => {
    onChange({ exec: [...(data.exec ?? []), ""] });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <PanelSection title={uiText("Container Settings")}>
        <InputField
          id="node-user"
          label={uiText("User")}
          value={data.user ?? ""}
          onChange={(value) => onChange({ user: value })}
          placeholder={uiText("Container user")}
          helperText={inheritedFieldHint(props, "user")}
        />
        <InputField
          id="node-entrypoint"
          label={uiText("Entrypoint")}
          value={data.entrypoint ?? ""}
          onChange={(value) => onChange({ entrypoint: value })}
          placeholder={uiText("Container entrypoint")}
          helperText={inheritedFieldHint(props, "entrypoint")}
        />
        <InputField
          id="node-cmd"
          label={uiText("Command")}
          value={data.cmd ?? ""}
          onChange={(value) => onChange({ cmd: value })}
          placeholder={uiText("Container command")}
          helperText={inheritedFieldHint(props, "cmd")}
        />
      </PanelSection>

      <PanelAddSection title={uiText("Exec Commands")} onAdd={handleAddExec}>
        <DynamicList
          items={data.exec ?? []}
          onChange={(items) => onChange({ exec: items })}
          placeholder={uiText("Command to execute")}
          hideAddButton
          inheritedItems={inheritedListItems(props, "exec")}
        />
      </PanelAddSection>

      <PanelSection title={uiText("Lifecycle")}>
        <InputField
          id="node-startup-delay"
          label={uiText("Startup Delay")}
          type="number"
          value={String(data.startupDelay ?? "")}
          onChange={(value) => onChange({ startupDelay: value ? parseInt(value, 10) : undefined })}
          placeholder="0"
          min={0}
          suffix="seconds"
          helperText={inheritedFieldHint(props, "startupDelay")}
        />
        <SelectField
          id="node-restart-policy"
          label={uiText("Restart Policy")}
          value={data.restartPolicy ?? ""}
          onChange={(value) => onChange({ restartPolicy: value })}
          options={withCurrentOption(RESTART_POLICY_OPTIONS, data.restartPolicy ?? "")}
          helperText={inheritedFieldHint(props, "restartPolicy")}
        />
        <CheckboxField
          id="node-auto-remove"
          label={uiText("Auto-remove container on exit")}
          checked={data.autoRemove ?? false}
          onChange={(checked) => onChange({ autoRemove: checked })}
        />
      </PanelSection>
    </Box>
  );
};
