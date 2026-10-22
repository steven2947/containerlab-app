import { uiText } from "@containerlab/clab-ui/i18n";
export * from "@containerlab/clab-ui/workspace/state";
import { confirmRuntimeAction, runtimeUiActions } from "@containerlab/clab-ui/workspace/state";
import { deleteTopologyFile, saveLabConfigs, type RuntimeTargetRequest } from "./runtimeApi";

export async function deleteTopologyFileFlow(target: RuntimeTargetRequest): Promise<boolean> {
  const fileLabel = target.topologyRef?.yamlPath ?? "this topology file";
  const confirmed = await confirmRuntimeAction({
    title: uiText("Delete Topology File"),
    message: uiText("Delete {0}?", { "0": (fileLabel) }),
    confirmLabel: uiText("Delete"),
    severity: "error"
  });
  if (!confirmed) {
    return false;
  }

  try {
    await deleteTopologyFile(target);
    runtimeUiActions.notify(uiText("Deleted {0}.", { "0": (fileLabel) }), "success");
    return true;
  } catch (error) {
    runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
    return false;
  }
}

export async function saveConfigsFlow(
  target: {
    endpointId?: string;
    sessionId?: string;
    topologyRef?: RuntimeTargetRequest["topologyRef"];
    nodeName?: string;
  },
  successLabel: string
): Promise<void> {
  try {
    const response = await saveLabConfigs(target);
    runtimeUiActions.notify(response.message || successLabel, "success");
  } catch (error) {
    runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
  }
}
