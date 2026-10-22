import { uiText } from "../i18n";
/** Host-neutral settings schema and validation, shared by the form and extension host. */
export interface SettingSchema {
  type: string;
  default?: unknown;
  description?: string;
  markdownDescription?: string;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
  items?: SettingSchema;
  properties?: Record<string, SettingSchema>;
  required?: string[];
  additionalProperties?: boolean | SettingSchema;
}
export type SettingsCategory =
  "general" | "appearance" | "labs" | "topology" | "terminal" | "capture";
export interface SettingDefinition extends SettingSchema {
  key: string;
  title: string;
  category: SettingsCategory;
  reloadRequired: boolean;
}
export interface SettingValue {
  value: unknown;
  effectiveValue: unknown;
  overridden: boolean;
  workspaceOverride: boolean;
  scopeValue?: unknown;
}
export type SettingsTarget = "user" | "workspace";
export interface SettingsSnapshot {
  definitions: SettingDefinition[];
  values: Record<string, SettingValue>;
  target: SettingsTarget;
  workspaceAvailable: boolean;
  workspaceName?: string;
  remoteName?: string;
  version: string;
  vscodeVersion: string;
  reloadRequired?: boolean;
}
export interface SettingsChange {
  key: string;
  target: SettingsTarget;
  value?: unknown;
  reset?: boolean;
  expected: { overridden: boolean; scopeValue?: unknown };
}
const TITLES: Record<string, string> = {
  showWelcomePage: uiText("Welcome page"),
  skipUpdateCheck: uiText("Skip update checks"),
  binaryPath: uiText("Containerlab binary"),
  skipCleanupWarning: uiText("Skip cleanup confirmation"),
  "deploy.extraArgs": uiText("Deploy arguments"),
  "destroy.extraArgs": uiText("Destroy arguments"),
  drawioDefaultTheme: uiText("Draw.io theme"),
  "gotty.port": uiText("GoTTY port"),
  runtime: uiText("Container runtime"),
  dockerSocketPath: uiText("Container socket"),
  refreshMode: uiText("Refresh mode"),
  pollInterval: uiText("Polling interval"),
  enableInterfaceStats: uiText("Interface statistics"),
  "editor.customNodes": uiText("Custom node templates"),
  "editor.updateLinkEndpointsOnKindChange": uiText("Update link endpoints"),
  "editor.lockLabByDefault": uiText("Lock canvas by default"),
  "node.execCommandMapping": uiText("Shell commands by node kind"),
  "node.sshUserMapping": uiText("SSH users by node kind"),
  "node.telnetPort": uiText("Telnet port"),
  "extras.fcli.extraDockerArgs": uiText("fcli container arguments"),
  "capture.remoteHostname": uiText("Capture hostname"),
  "capture.packetflixPort": uiText("Packetflix port"),
  "capture.preferredAction": uiText("Default capture method"),
  "capture.wireshark.dockerImage": uiText("Wireshark image"),
  "capture.wireshark.pullPolicy": uiText("Image pull policy"),
  "capture.wireshark.theme": uiText("Wireshark theme"),
  "capture.wireshark.stayOpenInBackground": uiText("Keep Wireshark running"),
  "capture.wireshark.vncCaptureHostname": uiText("Wireshark VNC hostname"),
  "capture.edgeshark.extraEnvironmentVars": uiText("Edgeshark environment variables"),
  "appearance.colorScheme": uiText("Color scheme"),
  "appearance.fontSize": uiText("Interface font size"),
  "appearance.fontFamily": uiText("Interface font family"),
  "appearance.reduceMotion": uiText("Reduce motion"),
};
const RELOAD_KEYS = new Set([
  "binaryPath",
  "runtime",
  "dockerSocketPath",
  "refreshMode",
  "pollInterval",
  "enableInterfaceStats",
]);
function categoryFor(key: string): SettingsCategory {
  if (key.startsWith("appearance.")) return "appearance";
  if (key.startsWith("capture.")) return "capture";
  if (key.startsWith("editor.") || key === "drawioDefaultTheme")
    return "topology";
  if (
    key.startsWith("node.") ||
    key.startsWith("extras.") ||
    key.startsWith("gotty.")
  )
    return "terminal";
  if (
    key.startsWith("deploy.") ||
    key.startsWith("destroy.") ||
    key === "skipCleanupWarning"
  )
    return "labs";
  return "general";
}
export function createSettingsCatalog(
  groups: Array<{ properties: Record<string, SettingSchema> }>,
): SettingDefinition[] {
  return groups.flatMap((group) =>
    Object.entries(group.properties).map(([key, schema]) => {
      const shortKey = key.replace(/^containerlab\./, "");
      return {
        ...schema,
        key,
        title: TITLES[shortKey] ?? shortKey,
        category: categoryFor(shortKey),
        reloadRequired: RELOAD_KEYS.has(shortKey),
      };
    }),
  );
}
export function isSettingsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validateSetting(
  schema: SettingSchema,
  value: unknown,
  label = "Value",
): string | undefined {
  if (schema.type === "array") {
    if (!Array.isArray(value)) return uiText("{0} must be a list.", { "0": (label) });
    for (const [index, item] of value.entries()) {
      const error =
        schema.items &&
        validateSetting(schema.items, item, `${label}, item ${index + 1}`);
      if (error) return error;
    }
  } else if (schema.type === "object") {
    if (!isSettingsRecord(value)) return uiText("{0} must be an object.", { "0": (label) });
    for (const key of schema.required ?? []) {
      if (!(key in value) || value[key] === "")
        return uiText("{0}: {1} is required.", { "0": (label), "1": (key) });
    }
    for (const [key, entry] of Object.entries(value)) {
      if (!key.trim()) return uiText("{0}: keys cannot be empty.", { "0": (label) });
      if (["__proto__", "constructor", "prototype"].includes(key))
        return uiText("{0}: unsupported key {1}.", { "0": (label), "1": (key) });
      const child =
        schema.properties?.[key] ??
        (typeof schema.additionalProperties === "object"
          ? schema.additionalProperties
          : undefined);
      if (!child && schema.additionalProperties === false)
        return uiText("{0}: unknown property {1}.", { "0": (label), "1": (key) });
      const error = child && validateSetting(child, entry, `${label}: ${key}`);
      if (error) return error;
    }
  } else if (typeof value !== schema.type)
    return uiText("{0} must be a {1}.", { "0": (label), "1": (schema.type) });
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return uiText("{0} must be a finite number.", { "0": (label) });
    if (schema.minimum !== undefined && value < schema.minimum)
      return uiText("{0} must be at least {1}.", { "0": (label), "1": (schema.minimum) });
    if (schema.maximum !== undefined && value > schema.maximum)
      return uiText("{0} must be at most {1}.", { "0": (label), "1": (schema.maximum) });
  }
  if (schema.enum && !schema.enum.includes(String(value)))
    return uiText("{0} must be one of: {1}.", { "0": (label), "1": (schema.enum.join(", ")) });
  return undefined;
}
export function validateSettingsChange(
  definition: SettingDefinition,
  value: unknown,
): string | undefined {
  const error = validateSetting(definition, value, definition.title);
  if (error) return error;
  if (definition.type === "number" && !Number.isInteger(value))
    return uiText("{0} must be a whole number.", { "0": (definition.title) });
  if (
    definition.key === "containerlab.appearance.fontSize" &&
    typeof value === "number" &&
    value !== 0 &&
    value < 10
  )
    return uiText("Use 0 to follow VS Code, or a size from 10 to 24.");
  if (
    definition.key === "containerlab.editor.customNodes" &&
    Array.isArray(value)
  ) {
    const names = new Set<string>();
    let defaults = 0;
    for (const item of value as Record<string, unknown>[]) {
      const name = String(item.name).trim();
      if (!name || !String(item.kind).trim())
        return uiText("Every template needs a name and a node kind.");
      if (names.has(name)) return uiText("Template names must be unique: {0}.", { "0": (name) });
      names.add(name);
      if (item.setDefault === true) defaults++;
    }
    if (defaults > 1) return uiText("Choose only one default node template.");
  }
  return undefined;
}
