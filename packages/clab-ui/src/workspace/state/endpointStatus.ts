import { uiText } from "../../i18n";
import type { AlertColor } from "@mui/material/Alert";

import type { EndpointStatus } from "../types";

export function endpointStatusLabel(status: EndpointStatus): string {
  switch (status) {
    case "connected":
      return uiText("Connected");
    case "session_expired":
      return uiText("Session Expired");
    case "offline":
      return uiText("Offline");
    case "saved":
      return uiText("Saved");
    default:
      return uiText("Unknown");
  }
}

export function endpointStatusSeverity(status: EndpointStatus): AlertColor {
  switch (status) {
    case "connected":
      return "success";
    case "session_expired":
      return "warning";
    case "offline":
      return "error";
    case "saved":
      return "info";
    default:
      return "info";
  }
}

export function endpointStatusHint(status: EndpointStatus): string {
  switch (status) {
    case "connected":
      return uiText("Authenticated and reachable.");
    case "session_expired":
      return uiText("Reconnect with your credentials to continue using this endpoint.");
    case "offline":
      return uiText("The endpoint cannot be reached right now. Reconnect when it is available again.");
    case "saved":
      return uiText("Saved locally. Reconnect to restore the browser session for this endpoint.");
    default:
      return "";
  }
}

export function endpointNeedsReconnect(status: EndpointStatus): boolean {
  return status === "saved" || status === "session_expired" || status === "offline";
}
