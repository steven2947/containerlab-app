import { uiText } from "../../../i18n";
// Advanced tab for node editor.
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import {
  InputField,
  SelectField,
  CheckboxField,
  DynamicList,
  KeyValueList,
  PanelAddSection,
  PanelSection
} from "../../ui/form";

import { isGoDuration } from "../../../core/utilities/nodeEditorConversions";

import { inheritedFieldHint, inheritedListItems, inheritedMapEntries } from "./inheritanceHints";
import type { TabProps, HealthCheckConfig } from "./types";
import { withCurrentOption } from "./selectOptions";

const KEY_SIZE_OPTIONS = [
  { value: "", label: uiText("Default") },
  { value: "2048", label: "2048" },
  { value: "4096", label: "4096" }
];

// Values as containerlab spells them (image-pull-policy is read case-insensitively)
const PULL_POLICY_OPTIONS = [
  { value: "", label: uiText("Default") },
  { value: "Always", label: uiText("Always") },
  { value: "Never", label: uiText("Never") },
  { value: "IfNotPresent", label: uiText("If Not Present") }
];

// containerlab runs nodes with docker or podman
const RUNTIME_OPTIONS = [
  { value: "", label: uiText("Default") },
  { value: "docker", label: "docker" },
  { value: "podman", label: "podman" }
];

const VALIDITY_HELP = "Go duration, e.g. 720h (30 days) or 8760h (1 year)";
const VALIDITY_ERROR = "Use a Go duration such as 720h or 1h30m; d and y are not units";

const ResourceLimitsSection: React.FC<TabProps> = ({ data, onChange, inheritance }) => (
  <PanelSection title={uiText("Resource Limits")}>
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
      <InputField
        id="node-cpu"
        label={uiText("CPU Limit")}
        type="number"
        value={String(data.cpu ?? "")}
        onChange={(v) => onChange({ cpu: v ? parseFloat(v) : undefined })}
        placeholder="e.g., 1.5"
        step={0.1}
        min={0}
        helperText={inheritedFieldHint({ data, inheritance }, "cpu")}
      />
      <InputField
        id="node-cpu-set"
        label={uiText("CPU Set")}
        value={data.cpuSet ?? ""}
        onChange={(v) => onChange({ cpuSet: v })}
        placeholder="e.g., 0-3, 0,3"
        helperText={inheritedFieldHint({ data, inheritance }, "cpuSet")}
      />
      <InputField
        id="node-memory"
        label={uiText("Memory Limit")}
        value={data.memory ?? ""}
        onChange={(v) => onChange({ memory: v })}
        placeholder={uiText("e.g., 1Gb, 512Mb")}
        helperText={inheritedFieldHint({ data, inheritance }, "memory")}
      />
      <InputField
        id="node-shm-size"
        label={uiText("Shared Memory Size")}
        value={data.shmSize ?? ""}
        onChange={(v) => onChange({ shmSize: v })}
        placeholder={uiText("e.g., 256MB")}
        helperText={inheritedFieldHint({ data, inheritance }, "shmSize")}
      />
    </Box>
  </PanelSection>
);

interface TlsCertificateSectionProps extends TabProps {
  certIssue: boolean;
}

const TlsCertificateSection: React.FC<TlsCertificateSectionProps> = ({
  data,
  onChange,
  certIssue
}) => {
  const keySize = data.certKeySize !== undefined ? String(data.certKeySize) : "";
  const validity = data.certValidity ?? "";
  const validityInvalid = validity.trim() !== "" && !isGoDuration(validity);

  return (
    <PanelSection title={uiText("TLS Certificate")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <CheckboxField
          id="node-cert-issue"
          label={uiText("Auto-generate TLS certificate")}
          checked={certIssue}
          onChange={(checked) => onChange({ certIssue: checked })}
        />
        {certIssue && (
          <>
            <SelectField
              id="node-cert-key-size"
              label={uiText("Key Size")}
              value={keySize}
              onChange={(v) => onChange({ certKeySize: v ? Number(v) : undefined })}
              options={withCurrentOption(KEY_SIZE_OPTIONS, keySize)}
            />
            <InputField
              id="node-cert-validity"
              label={uiText("Validity Duration")}
              value={validity}
              onChange={(v) => onChange({ certValidity: v })}
              placeholder="e.g., 720h"
              error={validityInvalid}
              helperText={validityInvalid ? VALIDITY_ERROR : VALIDITY_HELP}
            />
          </>
        )}
      </Box>
    </PanelSection>
  );
};

interface SansSectionProps extends TabProps {
  certIssue: boolean;
  sans: string[];
  onAddSan: () => void;
}

const SansSection: React.FC<SansSectionProps> = ({ certIssue, sans, onChange, onAddSan }) => {
  if (!certIssue) return null;

  return (
    <PanelAddSection title={uiText("SANs (Subject Alternative Names)")} onAdd={onAddSan}>
      <DynamicList
        items={sans}
        onChange={(items) => onChange({ sans: items })}
        placeholder={uiText("SAN entry")}
        hideAddButton
      />
    </PanelAddSection>
  );
};

interface HealthCheckSectionProps {
  healthCheck: Partial<HealthCheckConfig>;
  onUpdate: (updates: Partial<HealthCheckConfig>) => void;
}

const HealthCheckTestSection: React.FC<HealthCheckSectionProps> = ({ healthCheck, onUpdate }) => {
  const test = healthCheck.test ?? [];
  // The first entry says how the test runs, so a new test starts with CMD-SHELL
  const handleAdd = () => onUpdate({ test: [...test, test.length === 0 ? "CMD-SHELL" : ""] });

  return (
    <PanelAddSection title={uiText("Health Check Test")} onAdd={handleAdd}>
      {test.length > 0 && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>{uiText("One argument per row. The first row is CMD, CMD-SHELL or NONE.")}</Typography>
      )}
      <DynamicList
        items={test}
        onChange={(items) => onUpdate({ test: items })}
        placeholder={uiText("e.g., cat /etc/os-release")}
        hideAddButton
      />
    </PanelAddSection>
  );
};

const HealthCheckSection: React.FC<HealthCheckSectionProps> = ({ healthCheck, onUpdate }) => (
  <PanelSection title={uiText("Health Check")}>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <InputField
          id="node-healthcheck-start-period"
          label={uiText("Start Period (s)")}
          type="number"
          value={String(healthCheck.startPeriod ?? "")}
          onChange={(v) => onUpdate({ startPeriod: v ? parseInt(v, 10) : undefined })}
          placeholder="0"
          min={0}
        />
        <InputField
          id="node-healthcheck-interval"
          label={uiText("Interval (s)")}
          type="number"
          value={String(healthCheck.interval ?? "")}
          onChange={(v) => onUpdate({ interval: v ? parseInt(v, 10) : undefined })}
          placeholder="30"
          min={0}
        />
        <InputField
          id="node-healthcheck-timeout"
          label={uiText("Timeout (s)")}
          type="number"
          value={String(healthCheck.timeout ?? "")}
          onChange={(v) => onUpdate({ timeout: v ? parseInt(v, 10) : undefined })}
          placeholder="30"
          min={0}
        />
        <InputField
          id="node-healthcheck-retries"
          label={uiText("Retries")}
          type="number"
          value={String(healthCheck.retries ?? "")}
          onChange={(v) => onUpdate({ retries: v ? parseInt(v, 10) : undefined })}
          placeholder="3"
          min={0}
        />
      </Box>
    </Box>
  </PanelSection>
);

const RuntimeSection: React.FC<TabProps> = ({ data, onChange, inheritance }) => (
  <PanelSection title={uiText("Container Runtime")}>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <SelectField
        id="node-image-pull-policy"
        label={uiText("Image Pull Policy")}
        value={data.imagePullPolicy ?? ""}
        onChange={(v) => onChange({ imagePullPolicy: v })}
        options={withCurrentOption(PULL_POLICY_OPTIONS, data.imagePullPolicy ?? "")}
        helperText={inheritedFieldHint({ data, inheritance }, "imagePullPolicy")}
      />
      <SelectField
        id="node-runtime"
        label={uiText("Container Runtime")}
        value={data.runtime ?? ""}
        onChange={(v) => onChange({ runtime: v })}
        options={withCurrentOption(RUNTIME_OPTIONS, data.runtime ?? "")}
        helperText={inheritedFieldHint({ data, inheritance }, "runtime")}
      />
    </Box>
  </PanelSection>
);

export const AdvancedTab: React.FC<TabProps> = (props) => {
  const { data, onChange, inheritance } = props;
  const healthCheck = data.healthCheck ?? {};
  const capAdd = data.capAdd ?? [];
  const sysctls = data.sysctls ?? {};
  const devices = data.devices ?? [];
  const sans = data.sans ?? [];
  const certIssue = Boolean(data.certIssue);

  const updateHealthCheck = (updates: Partial<HealthCheckConfig>) => {
    onChange({ healthCheck: { ...healthCheck, ...updates } });
  };

  const handleAddCapability = () => {
    onChange({ capAdd: [...capAdd, ""] });
  };

  const handleAddSysctl = () => {
    onChange({ sysctls: { ...sysctls, "": "" } });
  };

  const handleAddDevice = () => {
    onChange({ devices: [...devices, ""] });
  };

  const handleAddSan = () => {
    onChange({ sans: [...sans, ""] });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <ResourceLimitsSection data={data} onChange={onChange} inheritance={inheritance} />
      <PanelAddSection title={uiText("Capabilities")} onAdd={handleAddCapability}>
        <DynamicList
          items={capAdd}
          onChange={(items) => onChange({ capAdd: items })}
          placeholder={uiText("e.g., NET_ADMIN")}
          hideAddButton
          inheritedItems={inheritedListItems(props, "capAdd")}
        />
      </PanelAddSection>
      <PanelAddSection title={uiText("Sysctls")} onAdd={handleAddSysctl}>
        <KeyValueList
          items={sysctls}
          onChange={(items) => onChange({ sysctls: items })}
          keyPlaceholder="Sysctl key"
          valuePlaceholder="Value"
          hideAddButton
          inheritedEntries={inheritedMapEntries(props, "sysctls")}
        />
      </PanelAddSection>
      <PanelAddSection title={uiText("Devices")} onAdd={handleAddDevice}>
        <DynamicList
          items={devices}
          onChange={(items) => onChange({ devices: items })}
          placeholder={uiText("host:container[:permissions]")}
          hideAddButton
          inheritedItems={inheritedListItems(props, "devices")}
        />
      </PanelAddSection>
      <TlsCertificateSection data={data} onChange={onChange} certIssue={certIssue} />
      <SansSection
        data={data}
        onChange={onChange}
        certIssue={certIssue}
        sans={sans}
        onAddSan={handleAddSan}
      />
      <HealthCheckTestSection healthCheck={healthCheck} onUpdate={updateHealthCheck} />
      <HealthCheckSection healthCheck={healthCheck} onUpdate={updateHealthCheck} />
      <RuntimeSection data={data} onChange={onChange} inheritance={inheritance} />
    </Box>
  );
};
