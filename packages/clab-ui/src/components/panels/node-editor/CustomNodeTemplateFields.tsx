import { uiText } from "../../../i18n";
// Custom node template fields.
import React from "react";

import { InputField } from "../../ui/form";

import type { TabProps } from "./types";

/**
 * Custom Node Template fields - shown only when editing custom node templates
 */
export const CustomNodeTemplateFields: React.FC<TabProps> = ({ data, onChange }) => (
  <>
    <InputField
      id="node-custom-name"
      label={uiText("Template Name")}
      value={data.customName ?? ""}
      onChange={(value) => onChange({ customName: value })}
      placeholder={uiText("Template name")}
    />
    <InputField
      id="node-base-name"
      label={uiText("Base Name (for canvas)")}
      value={data.baseName ?? ""}
      onChange={(value) => onChange({ baseName: value })}
      placeholder={uiText("e.g., srl (will become srl1, srl2, etc.)")}
    />
    <InputField
      id="node-interface-pattern"
      label={uiText("Interface Pattern")}
      value={data.interfacePattern ?? ""}
      onChange={(value) => onChange({ interfacePattern: value })}
      placeholder={uiText("e.g., e1-{n} or Gi0/0/{n:0}")}
    />
  </>
);
