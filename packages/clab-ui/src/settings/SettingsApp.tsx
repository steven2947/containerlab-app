import { uiText } from "../i18n";
import React, { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { SettingsLayout } from "./SettingsLayout";
import { filterSettings, type SettingsFilter } from "./settingsFilter";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import TerminalIcon from "@mui/icons-material/Terminal";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import { type SettingsNavigationItem } from "./SettingsNavigation";
import { floatingRadius } from "../theme/surfaces";
import { MONO_FONT_FAMILY } from "../theme/typography";
import { SettingCard } from "./SettingCard";
import type {
  SettingsChange,
  SettingsSnapshot,
  SettingsTarget,
} from "./schema";

const CATEGORIES: SettingsNavigationItem[] = [
  {
    key: "general",
    label: uiText("General & Runtime"),
    description: uiText("Your Containerlab environment"),
    icon: <SettingsOutlinedIcon fontSize="small" />,
  },
  {
    key: "appearance",
    label: uiText("Appearance"),
    description: uiText("Make yourself at home"),
    icon: <PaletteOutlinedIcon fontSize="small" />,
  },
  {
    key: "labs",
    label: uiText("Lab Actions"),
    description: uiText("Deploy, destroy, and cleanup"),
    icon: <ScienceOutlinedIcon fontSize="small" />,
  },
  {
    key: "topology",
    label: uiText("Topology"),
    description: uiText("Canvas and node templates"),
    icon: <AccountTreeOutlinedIcon fontSize="small" />,
  },
  {
    key: "terminal",
    label: uiText("Terminal"),
    description: uiText("Shells, SSH, and node actions"),
    icon: <TerminalIcon fontSize="small" />,
  },
  {
    key: "capture",
    label: uiText("Packet Capture"),
    description: uiText("Wireshark and Edgeshark"),
    icon: <HubOutlinedIcon fontSize="small" />,
  },
  {
    key: "about",
    label: uiText("About"),
    description: uiText("Versions and settings details"),
    icon: <InfoOutlinedIcon fontSize="small" />,
  },
];
export function SettingsApp({
  initial,
  request,
  subscribe,
}: {
  initial: SettingsSnapshot;
  request: (payload: Record<string, unknown>) => Promise<SettingsSnapshot>;
  subscribe: (listener: (snapshot: SettingsSnapshot) => void) => () => void;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [category, setCategory] = useState("general");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SettingsFilter>("all");
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());
  const [pendingTarget, setPendingTarget] = useState<SettingsTarget>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () =>
      subscribe((next) =>
        setSnapshot((current) =>
          next.target === current.target ? next : current,
        ),
      ),
    [subscribe],
  );
  const onDirty = useCallback(
    (key: string, dirty: boolean) =>
      setDirtyKeys((current) => {
        if (current.has(key) === dirty) return current;
        const next = new Set(current);
        if (dirty) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const onSave = async (change: SettingsChange) => {
    const next = await request({ action: "change", change });
    setSnapshot(next);
  };
  const refresh = async () => {
    setSnapshot(await request({ action: "read", target: snapshot.target }));
  };
  const action = async (name: string) => {
    try {
      await request({ action: name });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  const changeTarget = async (target: SettingsTarget) => {
    setBusy(true);
    setError("");
    try {
      setSnapshot(await request({ action: "read", target }));
      setDirtyKeys(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
      setPendingTarget(undefined);
    }
  };
  const query = search.trim().toLowerCase();
  const definitions = snapshot.definitions;
  const { visible, currentModified, allModified } = filterSettings(
    definitions,
    snapshot.values,
    category,
    search,
    filter,
  );
  const active =
    CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[0];
  const showAllCategories =
    filter === "modified-all" || (query.length > 0 && filter === "all");
  let title = active.label;
  let description = active.description;
  if (query.length > 0) {
    title = "Search results";
    description = `${visible.length} settings match “${search.trim()}”`;
  }
  if (filter === "modified-all") {
    title = "All modified settings";
    description = `${visible.length} overrides across all categories · ${snapshot.target === "user" ? uiText("User") : uiText("Workspace")}`;
  }
  const categories = CATEGORIES.map((item) => ({
    ...item,
    count:
      item.key === "about"
        ? undefined
        : definitions.filter((definition) => definition.category === item.key)
            .length,
  }));
  return (
    <>
      <SettingsLayout
        items={categories}
        active={category}
        onSelect={(key) => {
          setCategory(key);
          setSearch("");
          if (filter === "modified-all") setFilter("modified-view");
        }}
        sectionTitle={title}
        sectionDescription={description}
        headerActions={
          <Button
            variant="text"
            size="small"
            endIcon={<OpenInNewIcon />}
            onClick={() => {
              void action("native");
            }}
            sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
          >{uiText("VS Code Settings")}</Button>
        }
        toolbar={
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder={uiText("Search all settings…")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                slotProps={{
                  htmlInput: { "aria-label": uiText("Search settings") },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                select
                size="small"
                value={snapshot.target}
                disabled={busy}
                slotProps={{
                  select: { inputProps: { "aria-label": uiText("Save settings to") } },
                }}
                onChange={(event) => {
                  const target = event.target.value as SettingsTarget;
                  if (dirtyKeys.size) setPendingTarget(target);
                  else void changeTarget(target);
                }}
                sx={{ minWidth: 128 }}
              >
                <MenuItem value="user">{uiText("User")}</MenuItem>
                <MenuItem
                  value="workspace"
                  disabled={!snapshot.workspaceAvailable}
                >{uiText("Workspace")}</MenuItem>
              </TextField>
            </Stack>
            <ToggleButtonGroup
              value={filter}
              exclusive
              size="small"
              aria-label={uiText("Filter settings")}
              onChange={(_, next: SettingsFilter | null) => {
                if (next !== null) setFilter(next);
              }}
              sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
            >
              <ToggleButton value="all">{uiText("All in view")}</ToggleButton>
              <ToggleButton
                value="modified-view"
                aria-label={uiText("Modified in this view: {0}", { "0": (currentModified) })}
              >{uiText("Modified in view")}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {currentModified}
                </Box>
              </ToggleButton>
              <ToggleButton
                value="modified-all"
                aria-label={uiText("Modified across all settings: {0}", { "0": (allModified) })}
              >{uiText("All modified")}{" "}
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {allModified}
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
        sectionActions={
          category === "appearance" && !showAllCategories ? (
            <Button
              size="small"
              variant="text"
              startIcon={<PaletteOutlinedIcon />}
              onClick={() => {
                void action("colorTheme");
              }}
            >{uiText("VS Code theme")}</Button>
          ) : undefined
        }
        navigationFooter={
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "block",
              overflowWrap: "anywhere",
            }}
          >
            {snapshot.workspaceName ?? "Containerlab"}
            <br />
            {snapshot.remoteName
              ? uiText("Remote · {0}", { "0": (snapshot.remoteName) })
              : uiText("Local session")}{" "}
            · v{snapshot.version}
          </Typography>
        }
        footer={
          <>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <CheckCircleOutlineIcon
                sx={{
                  fontSize: 14,
                  color: dirtyKeys.size ? "text.secondary" : "success.main",
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                role="status"
              >
                {dirtyKeys.size
                  ? `${dirtyKeys.size} unsaved ${dirtyKeys.size === 1 ? "setting" : "settings"}`
                  : uiText("All changes saved")}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {definitions.length}{uiText(" settings ·")}{" "}
              {snapshot.target === "user" ? uiText("User") : uiText("Workspace")}
            </Typography>
          </>
        }
      >
        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {snapshot.reloadRequired && (
          <Alert
            severity="info"
            action={
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  void action("reload");
                }}
              >{uiText("Reload window")}</Button>
            }
          >{uiText("Runtime settings changed. Reload VS Code to apply them.")}</Alert>
        )}
        <Box key={snapshot.target} hidden={visible.length === 0}>
          {CATEGORIES.filter((item) => item.key !== "about").map((item) => {
            const categoryDefinitions = definitions.filter(
              (definition) => definition.category === item.key,
            );
            const hasVisible = categoryDefinitions.some((definition) =>
              visible.includes(definition),
            );
            return (
              <Box
                key={item.key}
                hidden={!hasVisible}
                sx={{ mb: showAllCategories ? 3 : 0 }}
              >
                {showAllCategories && (
                  <Typography
                    component="h3"
                    variant="overline"
                    sx={{ display: "block", mb: 1, color: "text.secondary" }}
                  >
                    {item.label}
                  </Typography>
                )}
                <Box
                  sx={{
                    display: "grid",
                    rowGap: 2,
                    // Visible rows read as one list, split by hairlines.
                    "& > div:not([hidden]) ~ div:not([hidden]) > [data-settings-row]":
                      { pt: 2, borderTop: 1, borderColor: "divider" },
                  }}
                >
                  {categoryDefinitions.map((definition) => (
                    <Box
                      key={definition.key}
                      hidden={!visible.includes(definition)}
                    >
                      <SettingCard
                        definition={definition}
                        current={snapshot.values[definition.key]}
                        target={snapshot.target}
                        onSave={onSave}
                        onDirty={onDirty}
                        onRefresh={refresh}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
        {!visible.length &&
          (query || category !== "about" || filter !== "all") && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                textAlign: "center",
                py: 6,
              }}
            >
              <SearchOffIcon
                sx={{
                  fontSize: 22,
                  color: "var(--vscode-icon-foreground)",
                  opacity: 0.7,
                }}
              />
              <Typography variant="subtitle1">{uiText("No matching settings")}</Typography>
              <Typography variant="body2" color="text.secondary">{uiText("Try another search or change the Modified filter.")}</Typography>
              <Button
                variant="outlined"
                size="small"
                sx={{ mt: 1 }}
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >{uiText("Clear filters")}</Button>
            </Box>
          )}
        {!query && category === "about" && filter === "all" && (
          <Box sx={{ display: "grid", gap: 1.5 }}>
            <Typography component="h3" variant="subtitle1">{uiText("Containerlab for VS Code")}</Typography>
            <Box
              component="dl"
              sx={{
                m: 0,
                border: 1,
                borderColor: "divider",
                borderRadius: floatingRadius,
              }}
            >
              {[
                ["Extension", snapshot.version],
                ["VS Code", snapshot.vscodeVersion],
              ].map(([label, value]) => (
                <Box
                  key={label}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "160px minmax(0, 1fr)",
                    columnGap: 2,
                    px: 1.5,
                    py: 1.25,
                    "&:not(:last-child)": {
                      borderBottom: 1,
                      borderColor: "divider",
                    },
                  }}
                >
                  <Typography
                    component="dt"
                    variant="body2"
                    color="text.secondary"
                  >
                    {label}
                  </Typography>
                  <Typography
                    component="dd"
                    sx={{ m: 0, fontFamily: MONO_FONT_FAMILY, fontSize: 12 }}
                  >
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary">{uiText("All ")}{definitions.length}{uiText(" Containerlab settings stay in sync with VS Code. User settings apply to this session; Workspace settings apply to the open workspace. Reset removes an override so the setting inherits again.")}</Typography>
          </Box>
        )}
      </SettingsLayout>
      <Dialog
        open={Boolean(pendingTarget)}
        onClose={() => setPendingTarget(undefined)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{uiText("Discard unsaved changes?")}</DialogTitle>
        <DialogContent>{uiText("Your drafts belong to the current settings scope. Save them first or discard them to switch.")}</DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setPendingTarget(undefined)}>{uiText("Keep editing")}</Button>
          <Button
            onClick={() => {
              if (pendingTarget) void changeTarget(pendingTarget);
            }}
            disabled={busy}
          >{uiText("Discard and switch")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
