import { uiText } from "../../../i18n";
// Keyboard shortcuts section for the settings drawer.
import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { MONO_FONT_FAMILY } from "../../../theme/typography";

/** Platform detection for keyboard symbols */
const isMac =
  typeof window !== "undefined" &&
  typeof window.navigator !== "undefined" &&
  /macintosh/i.test(window.navigator.userAgent);

/** Converts modifier keys based on platform */
function formatKey(key: string): string {
  if (!isMac) return key;
  return key.replace(/Ctrl/g, "Cmd").replace(/Alt/g, "Option");
}

interface ShortcutRowProps {
  label: string;
  shortcut: string;
}

const KEYCAP_SX = {
  display: "inline-flex",
  alignItems: "center",
  height: 20,
  px: 0.75,
  borderRadius: 1,
  border: 1,
  borderColor: "divider",
  bgcolor: "action.hover",
  color: "text.primary",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1,
  whiteSpace: "nowrap"
} as const;

/** Renders "Ctrl + A" as separate keycaps joined by a quiet plus. */
const ShortcutKeys: React.FC<{ shortcut: string }> = ({ shortcut }) => {
  const keys = formatKey(shortcut).split(" + ");
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          {index > 0 && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              +
            </Typography>
          )}
          <Box component="kbd" sx={KEYCAP_SX}>
            {key}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
};

const ShortcutRow: React.FC<ShortcutRowProps> = ({ label, shortcut }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 2,
      minHeight: 28
    }}
  >
    <Typography variant="body2">{label}</Typography>
    <ShortcutKeys shortcut={shortcut} />
  </Box>
);

interface ShortcutSectionProps {
  title: string;
  children: React.ReactNode;
}

const ShortcutSection: React.FC<ShortcutSectionProps> = ({ title, children }) => (
  <Box sx={{ "& + &": { mt: 2.5 } }}>
    <Typography
      variant="overline"
      component="h3"
      sx={{ display: "block", color: "text.secondary", mb: 0.5 }}
    >
      {title}
    </Typography>
    <Box>{children}</Box>
  </Box>
);

export const ShortcutsSection: React.FC = () => {
  return (
    <Box sx={{ px: 2.5, py: 2 }}>
      {/* Viewer Mode */}
      <ShortcutSection title={uiText("Viewer Mode")}>
        <ShortcutRow label={uiText("Select node/link")} shortcut="Left Click" />
        <ShortcutRow label={uiText("Node actions")} shortcut="Right Click" />
        <ShortcutRow label={uiText("Capture packets")} shortcut="Right Click + Link" />
        <ShortcutRow label={uiText("Move nodes")} shortcut="Drag" />
      </ShortcutSection>

      {/* Editor Mode */}
      <ShortcutSection title={uiText("Editor Mode")}>
        <ShortcutRow label={uiText("Add node")} shortcut="Shift + Click" />
        <ShortcutRow label={uiText("Create link")} shortcut="Shift + Click node" />
        <ShortcutRow label={uiText("Delete element")} shortcut="Alt + Click" />
        <ShortcutRow label={uiText("Context menu")} shortcut="Right Click" />
        <ShortcutRow label={uiText("Select all")} shortcut="Ctrl + A" />
        <ShortcutRow label={uiText("Multi-select")} shortcut="Shift + Click" />
        <ShortcutRow label={uiText("Copy selected")} shortcut="Ctrl + C" />
        <ShortcutRow label={uiText("Paste")} shortcut="Ctrl + V" />
        <ShortcutRow label={uiText("Duplicate selected")} shortcut="Ctrl + D" />
        <ShortcutRow label={uiText("Undo")} shortcut="Ctrl + Z" />
        <ShortcutRow label={uiText("Redo")} shortcut="Ctrl + Y" />
        <ShortcutRow label={uiText("Create group")} shortcut="Ctrl + G" />
        <ShortcutRow label={uiText("Delete selected")} shortcut="Del" />
      </ShortcutSection>

      {/* Navigation */}
      <ShortcutSection title={uiText("Navigation")}>
        <ShortcutRow label={uiText("Deselect all")} shortcut="Esc" />
      </ShortcutSection>

      {/* Tips */}
      <ShortcutSection title={uiText("Tips")}>
        <Typography
          variant="body2"
          component="ul"
          sx={{
            pl: 2,
            m: 0,
            color: "text.secondary",
            "& li": { mb: 0.5 },
            "& code": { fontFamily: MONO_FONT_FAMILY, fontSize: 12, color: "text.primary" }
          }}
        >
          <li>{uiText("Use layout algorithms to auto-arrange")}</li>
          <li>{uiText("Box select nodes, then ")}<code>Ctrl+G</code>{uiText(" to group or ")}<code>Del</code>{uiText(" to delete")}</li>
          <li>{uiText("Double-click any item to directly edit")}</li>
          <li>{uiText("Shift+Click a node to start creating a link")}</li>
        </Typography>
      </ShortcutSection>
    </Box>
  );
};
