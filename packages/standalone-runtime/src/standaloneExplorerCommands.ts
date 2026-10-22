import { uiText } from "@containerlab/clab-ui/i18n";
import type { TopologyRef } from "@containerlab/clab-ui/session";
import {
  dispatchEndpointUiAction,
  getSessionHostnameOverride,
  loadCapturePreferences,
  resolveStandaloneTheme,
  runtimeUiActions,
  setSessionHostnameOverride
} from "@containerlab/clab-ui/workspace/state";
import {
  buildPacketflixCapture,
  closeAllWiresharkVncSessions,
  controlNodeLifecycle,
  createFileExplorerDirectory,
  createTopologyFile,
  deleteFileExplorerPath,
  deployLabFromUrl,
  downloadFileExplorerFile,
  downloadLabArchive,
  importTopologyFromUrl,
  fetchNodeBrowserPorts,
  generateDrawioGraph,
  installEdgeShark,
  readFileExplorerFile,
  renameFileExplorerPath,
  runFcliCommand,
  uninstallEdgeShark,
  uploadFileExplorerFile,
  writeFileExplorerFile,
  type NetemFields
} from "./runtimeApi";
import {
  confirmRuntimeAction,
  deleteTopologyFileFlow,
  normalizeTopologyFileNameForCreate,
  promptForCloneRepo,
  promptForCreateTopology,
  promptForOptionSelection,
  promptForTextInput,
  saveConfigsFlow,
  type CloneRepoDialogTarget
} from "./runtimeActionFlows";
import type { WiresharkCaptureRequest } from "./wiresharkCaptureLauncher";
import { openWiresharkCaptureWindow } from "./wiresharkCaptureWindow";
import type { LifecycleCommandEndpoint } from "./standaloneHostShared";
import {
  findLabStateForTopology,
  firstArgAsTopologyRef,
  firstArgAsTreeItem,
  normalizeLabName,
  normalizePathValue,
  isSharedWorkspacePath,
  safeFilename
} from "./standaloneHostShared";
import { toggleStandaloneFavorite } from "./standaloneFavorites";
import {
  type ShareActionKind,
  type ShareLifecycleAction,
  persistShowNonOwnedLabsSetting,
  explorerPreferences,
  findEndpointConfig,
  resolveExplorerActionTopologyRef,
  resolveExplorerActionEndpointId,
  resolveExplorerTargetLabel,
  resolveEndpointForExplorerAction,
  sortedRunningContainers,
  topologyRefForNodeActions,
  sshOpenedNotification,
  runLabShareAction,
  persistShareLink,
  handleShareActionLink,
  deploymentStateFromContext,
  nodeAccessProtocol,
  nodeAccessTitlePrefix,
  fetchPopularRepos,
  pickPopularRepo,
  triggerTextDownload,
  triggerBlobDownload,
  pickTransferFiles,
  promptArchiveFormat,
  resolveArchiveLabFolder,
  extractFirstHttpLink,
  describeBrowserPort,
  fileParentPath,
  joinWorkspacePath,
  type StandaloneExplorerBridgeOptions
} from "./standaloneExplorerActions";

interface ExplorerCommandContext {
  options: StandaloneExplorerBridgeOptions;
  postExplorerError: (message: string) => void;
  clearFileExplorerCache: (endpointId?: string) => void;
  scheduleSnapshot: (delay?: number) => void;
  sshxLinksByLab: Map<string, string>;
  gottyLinksByLab: Map<string, string>;
}

export function createExplorerCommandHandler(context: ExplorerCommandContext) {
  const {
    options,
    postExplorerError,
    clearFileExplorerCache,
    scheduleSnapshot,
    sshxLinksByLab,
    gottyLinksByLab
  } = context;
  const lifecycleActionsAvailable = options.lifecycleActionsAvailable !== false;
  const unhandledCommands = new Set<string>();
  return async function executeExplorerCommand(commandId: string, args: unknown[]): Promise<void> {
    const requestedTopologyRef = firstArgAsTopologyRef(args);
    const item = firstArgAsTreeItem(args);
    const actionTopologyRef = requestedTopologyRef ?? (await options.resolveTopologyRef(args));
    const actionEndpointId = resolveExplorerActionEndpointId(item, actionTopologyRef);
    const endpoints = options.getEndpoints();
    const resolveEndpointForAction = async (
      actionDescription: string,
      preferredEndpointId?: string
    ): Promise<string | null> =>
      resolveEndpointForExplorerAction({
        actionDescription,
        endpoints,
        postError: postExplorerError,
        preferredEndpointId
      });
    const targetLabel = resolveExplorerTargetLabel(item, actionTopologyRef);
    const refreshWorkspaceAfterMutation = (endpointId?: string): void => {
      options.invalidateTopologyFileListCache(endpointId);
      clearFileExplorerCache(endpointId);
      scheduleSnapshot(0);
    };
    const resolveActionTopologyRef = (): TopologyRef | undefined =>
      resolveExplorerActionTopologyRef({
        actionEndpointId,
        actionTopologyRef,
        item,
        labs: options.getLabs(),
        targetLabel
      });
    const resolveCaptureTargets = (): Array<{
      containerName: string;
      interfaceName: string;
      nodeNamespace?: boolean;
    }> => {
      const byKey = new Map<string, { containerName: string; interfaceName: string }>();

      const pushCandidate = (candidate: unknown): void => {
        if (!candidate || typeof candidate !== "object") {
          return;
        }
        const containerName =
          typeof (candidate as { containerName?: unknown }).containerName === "string"
            ? (candidate as { containerName: string }).containerName.trim()
            : "";
        const interfaceName =
          typeof (candidate as { name?: unknown }).name === "string"
            ? (candidate as { name: string }).name.trim()
            : "";
        if (!containerName || !interfaceName) {
          return;
        }
        byKey.set(`${containerName}::${interfaceName}`, {
          containerName,
          interfaceName
        });
      };

      for (const candidate of args) {
        if (Array.isArray(candidate)) {
          for (const nested of candidate) {
            pushCandidate(nested);
          }
          continue;
        }
        pushCandidate(candidate);
      }

      if (byKey.size === 0 && item) {
        pushCandidate(item);
      }

      return [...byKey.values()];
    };

    type CaptureTargets = ReturnType<typeof resolveCaptureTargets>;

    const runPacketflixCapture = async (
      targets: CaptureTargets = resolveCaptureTargets()
    ): Promise<void> => {
      if (!actionTopologyRef) {
        postExplorerError(uiText("No canonical topology reference is available for this item."));
        return;
      }
      if (targets.length === 0) {
        postExplorerError(uiText("Capture requires a running interface item."));
        return;
      }

      try {
        const captureResponse = await buildPacketflixCapture({
          endpointId: actionEndpointId,
          topologyRef: actionTopologyRef,
          targets,
          remoteHostname: getSessionHostnameOverride(actionEndpointId)
        });

        const captures = captureResponse.captures ?? [];
        if (captures.length === 0) {
          runtimeUiActions.notify(uiText("No packet capture targets were returned."), "warning");
          return;
        }

        for (const capture of captures) {
          const link = capture.packetflixUri?.trim();
          if (!link) {
            continue;
          }
          window.open(link, "_blank", "noopener,noreferrer");
        }

        runtimeUiActions.notify(
          captures.length > 1
            ? uiText("Started {0} Edgeshark capture targets.", { "0": (captures.length) })
            : uiText("Started Edgeshark capture for {0}.", { "0": (captures[0]?.containerName ?? "interface") }),
          "success"
        );
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    /** Every request opens in the same Wireshark window, one tab per session. */
    const runWiresharkVncCapture = async (
      requests: WiresharkCaptureRequest[] = [{ targets: resolveCaptureTargets() }]
    ): Promise<void> => {
      if (!actionTopologyRef) {
        postExplorerError(uiText("No canonical topology reference is available for this item."));
        return;
      }
      const captures = requests.filter((request) => request.targets.length > 0);
      if (captures.length === 0) {
        postExplorerError(uiText("Capture requires a running interface item."));
        return;
      }

      const opened = await openWiresharkCaptureWindow(
        captures,
        { endpointId: actionEndpointId, topologyRef: actionTopologyRef },
        resolveStandaloneTheme()
      );
      if (opened > 0) {
        runtimeUiActions.notify(
          opened > 1 ? uiText("Opened {0} Wireshark VNC sessions.", { "0": (opened) }) : uiText("Opened Wireshark VNC session."),
          "success"
        );
      }
    };

    const runPreferredCapture = async (
      requests: WiresharkCaptureRequest[] = [{ targets: resolveCaptureTargets() }]
    ): Promise<void> => {
      const preferredAction = loadCapturePreferences(actionEndpointId).preferredAction;
      if (preferredAction === "edgeshark") {
        await Promise.all(requests.map((request) => runPacketflixCapture(request.targets)));
        return;
      }
      await runWiresharkVncCapture(requests);
    };

    const openNodeCaptureDialog = (): void => {
      const containerName = item?.name;
      if (!actionTopologyRef || !containerName) {
        postExplorerError(uiText("Capture requires a running node item."));
        return;
      }
      runtimeUiActions.openCapture({
        endpointId: actionEndpointId,
        topologyRef: actionTopologyRef,
        nodeName: containerName,
        title: uiText("Capture: {0}", { "0": (item.label || containerName) }),
        onCapture: (sessions) => {
          void runPreferredCapture(
            sessions.map(({ interfaceNames, nodeNamespace, label }) => ({
              targets: interfaceNames.map((interfaceName) => ({
                containerName,
                interfaceName,
                ...(nodeNamespace ? { nodeNamespace } : {})
              })),
              ...(label !== undefined ? { label } : {})
            }))
          );
        }
      });
    };

    const cloneFromUrlFlow = async (
      endpointId: string,
      sourceUrl: string,
      cloneOptions?: {
        labNameOverride?: string;
        skipLabNamePrompt?: boolean;
        target?: CloneRepoDialogTarget;
      }
    ): Promise<void> => {
      const topologySourceUrl = sourceUrl.trim();
      if (!topologySourceUrl) {
        runtimeUiActions.notify(uiText("A repository or topology URL is required."), "error");
        return;
      }
      const target = cloneOptions?.target ?? "deploy";

      let labNameOverride: string | undefined;
      if (cloneOptions?.skipLabNamePrompt) {
        labNameOverride = cloneOptions.labNameOverride?.trim() || undefined;
      } else {
        const rawLabNameOverride = await promptForTextInput({
          title: uiText("Lab Name Override"),
          message: uiText("Leave empty to use the default lab name."),
          label: uiText("Lab name override"),
          confirmLabel: "Continue",
          allowEmpty: true
        });
        if (rawLabNameOverride === undefined) {
          return;
        }
        labNameOverride = rawLabNameOverride.trim() || undefined;
      }

      try {
        if (target === "undeployed") {
          const response = await importTopologyFromUrl({
            endpointId,
            topologySourceUrl,
            labNameOverride
          });
          refreshWorkspaceAfterMutation(endpointId);
          runtimeUiActions.notify(uiText("Cloned {0} to undeployed labs.", { "0": (response.labName) }), "success");
          await options.loadTopologyFile(response.topologyRef, {
            deploymentState: "undeployed",
            endpointId
          });
          return;
        }

        const response = await deployLabFromUrl({
          endpointId,
          topologySourceUrl,
          labNameOverride
        });
        refreshWorkspaceAfterMutation(endpointId);
        const labNames = response.labNames ?? [];
        runtimeUiActions.notify(
          labNames.length > 0
            ? uiText("Deployed {0} from source URL.", { "0": (labNames.join(", ")) })
            : uiText("Deployment from source URL finished successfully."),
          "success"
        );
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const openSshToAllNodes = (): void => {
      const lab = findLabStateForTopology(
        {
          absoluteYamlPath: actionTopologyRef?.absoluteYamlPath,
          yamlPath: actionTopologyRef?.yamlPath ?? "",
          topologyId: actionTopologyRef?.topologyId,
          labName: actionTopologyRef?.labName ?? item?.labName,
          endpointId: actionEndpointId
        },
        options.getLabs()
      );
      if (!lab) {
        postExplorerError(uiText("No running lab context is available for this action."));
        return;
      }

      const topologyRef = topologyRefForNodeActions(lab, actionTopologyRef);
      const containers = sortedRunningContainers(lab);
      if (containers.length === 0) {
        runtimeUiActions.notify(uiText("No containers were found in lab \"{0}\".", { "0": (lab.name) }), "warning");
        return;
      }

      for (const container of containers) {
        const nodeName = container.nodeName || container.name;
        runtimeUiActions.openTerminal({
          endpointId: lab.endpointId,
          topologyRef,
          nodeName,
          protocol: "ssh",
          title: `SSH: ${nodeName}`
        });
      }
      runtimeUiActions.notify(sshOpenedNotification(containers), "success");
    };

    const shareLabKey = actionTopologyRef?.labName ?? item?.labName ?? "";
    const resolveShareLabKey = (): string => {
      const topologyRef = resolveActionTopologyRef();
      return topologyRef?.labName ?? shareLabKey;
    };

    const openCommandOutputTerminal = (
      title: string,
      commandLabel: string,
      output: string,
      topologyRef?: TopologyRef
    ): void => {
      const content = output.trim();
      runtimeUiActions.openTerminal({
        endpointId: actionEndpointId,
        sessionId: `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        topologyRef,
        nodeName: commandLabel,
        protocol: "output",
        title,
        initialOutput: content || "(no output)"
      });
    };

    const resolveBrowserHost = (rawHost?: string): string => {
      const trimmed = (rawHost ?? "").trim().replace(/^\[|\]$/g, "");
      const lowered = trimmed.toLowerCase();
      if (
        trimmed &&
        lowered !== "localhost" &&
        lowered !== "127.0.0.1" &&
        lowered !== "::1" &&
        lowered !== "0.0.0.0" &&
        lowered !== "::"
      ) {
        return trimmed;
      }

      const endpoint = findEndpointConfig(endpoints, actionEndpointId);
      if (endpoint) {
        try {
          return new URL(endpoint.url).hostname;
        } catch {
          // Ignore malformed endpoint URLs.
        }
      }

      return trimmed || "localhost";
    };

    const runNodeLifecycle = async (
      action: "start" | "stop" | "restart" | "pause" | "unpause",
      successLabel: string
    ): Promise<void> => {
      if (!actionTopologyRef || !item?.name) {
        postExplorerError(uiText("Node action requires a running lab item."));
        return;
      }

      try {
        await controlNodeLifecycle({
          endpointId: actionEndpointId,
          topologyRef: actionTopologyRef,
          nodeName: item.name,
          action
        });
        runtimeUiActions.notify(successLabel, "success");
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const openNodeBrowser = async (): Promise<void> => {
      if (!actionTopologyRef || !item?.name) {
        postExplorerError(uiText("Open Browser requires a running node item."));
        return;
      }

      try {
        const payload = await fetchNodeBrowserPorts({
          endpointId: actionEndpointId,
          topologyRef: actionTopologyRef,
          nodeName: item.name
        });
        const ports = payload.ports ?? [];
        if (ports.length === 0) {
          runtimeUiActions.notify(uiText("No exposed ports were found for {0}.", { "0": (item.name) }), "warning");
          return;
        }

        const candidates = ports.map((port) => {
          const host = resolveBrowserHost(port.hostIp);
          const hostForUrl = host.includes(":") ? `[${host}]` : host;
          const description = port.description || describeBrowserPort(port.containerPort);
          return {
            ...port,
            description,
            url: `http://${hostForUrl}:${port.hostPort}`
          };
        });

        if (candidates.length === 1) {
          window.open(candidates[0].url, "_blank", "noopener,noreferrer");
          runtimeUiActions.notify(uiText("Opened {0}.", { "0": (candidates[0].url) }), "success");
          return;
        }

        const selectedUrl = await promptForOptionSelection({
          title: uiText("Open Browser Port"),
          message: uiText("Select a port to open in the browser."),
          label: uiText("Port"),
          confirmLabel: "Open",
          options: candidates.map((candidate) => ({
            label: `${candidate.hostPort}:${candidate.containerPort}/${candidate.protocol || "tcp"}`,
            description: candidate.description,
            value: candidate.url
          })),
          preferredValue: candidates[0]?.url
        });
        if (!selectedUrl) {
          return;
        }

        const target = candidates.find((candidate) => candidate.url === selectedUrl);
        if (!target) {
          runtimeUiActions.notify(uiText("Invalid port selection."), "error");
          return;
        }
        window.open(target.url, "_blank", "noopener,noreferrer");
        runtimeUiActions.notify(uiText("Opened {0}.", { "0": (target.url) }), "success");
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const runShareAction = async (
      kind: ShareActionKind,
      action: ShareLifecycleAction
    ): Promise<void> => {
      const topologyRef = resolveActionTopologyRef();
      if (!topologyRef) {
        postExplorerError(uiText("Sharing actions require a running lab item."));
        return;
      }

      try {
        runtimeUiActions.notify(
          uiText("{0} {1} started. This may take a moment...", { "0": (kind.toUpperCase()), "1": (action) }),
          "info"
        );

        const payload = await runLabShareAction({
          action,
          endpointId: actionEndpointId,
          kind,
          topologyRef
        });
        const link = payload.link?.trim() || extractFirstHttpLink(payload.output ?? "") || "";
        const labKey = normalizeLabName(topologyRef.labName || resolveShareLabKey());
        const bucket = kind === "sshx" ? sshxLinksByLab : gottyLinksByLab;
        persistShareLink({ action, bucket, labKey, link });
        scheduleSnapshot(0);

        await handleShareActionLink(kind, action, link);
        runtimeUiActions.notify(
          payload.message || `${kind.toUpperCase()} ${action} completed.`,
          "success"
        );
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const copyShareLink = async (kind: "sshx" | "gotty"): Promise<void> => {
      const argLink = typeof args[0] === "string" ? args[0].trim() : "";
      const bucket = kind === "sshx" ? sshxLinksByLab : gottyLinksByLab;
      const storedLabKey = normalizeLabName(resolveShareLabKey());
      const storedLink = storedLabKey ? (bucket.get(storedLabKey) ?? "") : "";
      const link = argLink || storedLink;
      if (!link) {
        runtimeUiActions.notify(
          uiText("No {0} link is currently available for this lab.", { "0": (kind.toUpperCase()) }),
          "warning"
        );
        return;
      }

      await navigator.clipboard.writeText(link).catch(() => {});
      runtimeUiActions.notify(uiText("{0} link copied to clipboard.", { "0": (kind.toUpperCase()) }), "success");
    };

    const runFcli = async (command: string): Promise<void> => {
      const topologyRef = resolveActionTopologyRef();
      if (!topologyRef) {
        postExplorerError(uiText("fcli actions require a running lab item."));
        return;
      }

      try {
        runtimeUiActions.notify(
          uiText("Running fcli \"{0}\"... image pull may take a while.", { "0": (command) }),
          "info"
        );
        const response = await runFcliCommand({
          endpointId: actionEndpointId,
          topologyRef,
          command
        });
        const content = response.output?.trim() || "(no output)";
        openCommandOutputTerminal(`fcli: ${command}`, `fcli ${command}`, content, topologyRef);
        if (/\bNo data\.\.\./i.test(content)) {
          runtimeUiActions.notify(
            uiText("fcli \"{0}\" returned no data. Check lab state/filter and try a different command (for example sys-info).", { "0": (command) }),
            "warning"
          );
        } else {
          runtimeUiActions.notify(
            uiText("fcli \"{0}\" finished. Output opened in terminal.", { "0": (command) }),
            "success"
          );
        }
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const runDrawio = async (layout: "horizontal" | "vertical" | "interactive"): Promise<void> => {
      const topologyRef = resolveActionTopologyRef();
      if (!topologyRef) {
        postExplorerError(uiText("Graph actions require a lab item."));
        return;
      }

      try {
        runtimeUiActions.notify(uiText("Generating draw.io ({0})...", { "0": (layout) }), "info");
        const response = await generateDrawioGraph({
          endpointId: actionEndpointId,
          topologyRef,
          layout
        });

        triggerTextDownload(
          safeFilename(response.fileName || `${topologyRef.labName}.drawio`),
          response.content,
          "application/xml"
        );

        if (layout === "interactive") {
          const output = [response.output?.trim(), response.message?.trim()]
            .filter((value): value is string => Boolean(value && value.length > 0))
            .join("\n\n");
          openCommandOutputTerminal(
            `draw.io interactive: ${topologyRef.labName}`,
            "graph drawio -I",
            output || "Interactive draw.io output is unavailable.",
            topologyRef
          );
        }

        runtimeUiActions.notify(
          response.message || `Generated draw.io (${layout}) for ${topologyRef.labName}.`,
          "success"
        );
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const requireTopologyRef = (
      message = "No canonical topology reference is available for this item."
    ): TopologyRef | undefined => {
      if (!actionTopologyRef) {
        postExplorerError(message);
        return undefined;
      }
      return actionTopologyRef;
    };

    const runEndpointEdgeSharkAction = async (action: "install" | "uninstall"): Promise<void> => {
      const endpointId = await resolveEndpointForAction(`${action} EdgeShark`, actionEndpointId);
      if (!endpointId) {
        return;
      }
      if (
        action === "uninstall" &&
        !(await confirmRuntimeAction({
          title: uiText("Uninstall EdgeShark"),
          message: uiText("Uninstall EdgeShark on this endpoint?"),
          confirmLabel: uiText("Uninstall"),
          severity: "warning"
        }))
      ) {
        return;
      }
      try {
        await (action === "install"
          ? installEdgeShark(endpointId)
          : uninstallEdgeShark(endpointId));
        runtimeUiActions.notify(
          `${action === "install" ? uiText("Installed") : uiText("Uninstalled")} EdgeShark.`,
          "success"
        );
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const openTopologyFile = async (): Promise<void> => {
      const topologyRef = requireTopologyRef(
        targetLabel
          ? uiText("No canonical topology reference is available for running lab \"{0}\".", { "0": (targetLabel) })
          : uiText("No canonical topology reference is available for this item.")
      );
      if (!topologyRef) {
        return;
      }
      const itemState = deploymentStateFromContext(item?.contextValue);
      const resolvedState = await options.resolveDeploymentState(topologyRef);
      await options.loadTopologyFile(topologyRef, {
        deploymentState: resolvedState ?? itemState,
        endpointId: actionEndpointId
      });
    };

    const createTopologyFileFlow = async (): Promise<void> => {
      const connectedEndpoints = endpoints.filter((endpoint) => endpoint.status === "connected");
      if (connectedEndpoints.length === 0) {
        postExplorerError(uiText("Connect an endpoint before trying to create a topology file."));
        return;
      }
      const preferredEndpoint = findEndpointConfig(endpoints, actionEndpointId);
      const createTopologyInput = await promptForCreateTopology({
        title: uiText("Create Topology File"),
        confirmLabel: uiText("Create"),
        endpointOptions: connectedEndpoints.map((endpoint) => ({
          value: endpoint.id,
          label: endpoint.label,
          description: endpoint.url
        })),
        defaultEndpointId:
          preferredEndpoint?.status === "connected"
            ? preferredEndpoint.id
            : connectedEndpoints[0]?.id,
        defaultFileName: joinWorkspacePath(selectedDirectoryPath(), "new-lab.clab.yml")
      });
      if (!createTopologyInput) {
        return;
      }
      const fileName = normalizeTopologyFileNameForCreate(createTopologyInput.fileName);
      try {
        const created = await createTopologyFile({
          endpointId: createTopologyInput.endpointId,
          fileName
        });
        refreshWorkspaceAfterMutation(createTopologyInput.endpointId);
        runtimeUiActions.notify(uiText("Created topology file \"{0}\".", { "0": (fileName) }), "success");
        await options.loadTopologyFile(created.topologyRef, {
          deploymentState: "undeployed",
          endpointId: createTopologyInput.endpointId
        });
      } catch (error) {
        runtimeUiActions.notify(error instanceof Error ? error.message : String(error), "error");
      }
    };

    const cloneRepositoryFlow = async (): Promise<void> => {
      const connectedEndpoints = endpoints.filter((endpoint) => endpoint.status === "connected");
      if (connectedEndpoints.length === 0) {
        postExplorerError(uiText("Connect an endpoint before trying to clone a repository."));
        return;
      }
      const preferredEndpoint = findEndpointConfig(endpoints, actionEndpointId);
      const popularRepos = (await fetchPopularRepos()).slice(0, 12);
      const cloneRepoInput = await promptForCloneRepo({
        title: uiText("Clone Repository"),
        message: uiText("Choose endpoint, source, and target action."),
        confirmLabel: "Continue",
        endpointOptions: connectedEndpoints.map((endpoint) => ({
          value: endpoint.id,
          label: endpoint.label,
          description: endpoint.url
        })),
        popularOptions: popularRepos.map((repo) => ({
          value: repo.htmlUrl,
          label: `${repo.name} (⭐ ${repo.stars})`,
          description: repo.description
        })),
        defaultEndpointId:
          preferredEndpoint?.status === "connected"
            ? preferredEndpoint.id
            : connectedEndpoints[0]?.id,
        defaultMode: "url",
        defaultSourceUrl: "https://github.com/srl-labs/srl-telemetry-lab",
        defaultTarget: lifecycleActionsAvailable ? "deploy" : "undeployed"
      });
      if (cloneRepoInput) {
        await cloneFromUrlFlow(cloneRepoInput.endpointId, cloneRepoInput.sourceUrl, {
          labNameOverride: cloneRepoInput.labNameOverride,
          skipLabNamePrompt: true,
          target: cloneRepoInput.target
        });
      }
    };

    const clonePopularFlow = async (target: CloneRepoDialogTarget): Promise<void> => {
      const endpointId = await resolveEndpointForAction(
        target === "undeployed" ? uiText("clone a popular lab") : uiText("deploy a popular lab"),
        actionEndpointId
      );
      const sourceUrl = endpointId
        ? await pickPopularRepo(
            target === "undeployed" ? uiText("Clone popular lab") : uiText("Deploy popular lab")
          )
        : undefined;
      if (endpointId && sourceUrl) {
        await cloneFromUrlFlow(endpointId, sourceUrl, { target });
      }
    };

    const runLabLifecycle = async (
      endpoint: LifecycleCommandEndpoint,
      cleanup = false
    ): Promise<void> => {
      if (!lifecycleActionsAvailable) {
        runtimeUiActions.notify(
          uiText("This action is not available."),
          "warning"
        );
        return;
      }
      const topologyRef = requireTopologyRef();
      if (!topologyRef) {
        return;
      }
      try {
        await options.runLifecycle(endpoint, topologyRef, cleanup);
      } catch (error) {
        console.error(`[Standalone] ${endpoint} failed:`, error);
      }
    };

    const deleteTopologyFlow = async (): Promise<void> => {
      const topologyRef = requireTopologyRef();
      if (!topologyRef) {
        return;
      }
      const deleted = await deleteTopologyFileFlow({
        endpointId: actionEndpointId,
        topologyRef
      });
      if (deleted) {
        refreshWorkspaceAfterMutation(actionEndpointId);
      }
    };

    const toggleFavoriteFlow = (): void => {
      const topologyRef = requireTopologyRef();
      if (!topologyRef) {
        return;
      }
      const nextFavorite = toggleStandaloneFavorite({
        endpointId: actionEndpointId,
        topologyRef
      });
      scheduleSnapshot(0);
      runtimeUiActions.notify(
        nextFavorite ? uiText("Added lab to favorites.") : uiText("Removed lab from favorites."),
        "success"
      );
    };

    const openNodeAccessTerminal = (): void => {
      if (!actionTopologyRef || !item?.name) {
        postExplorerError(uiText("Node access requires a running lab item."));
        return;
      }
      const protocol = nodeAccessProtocol(commandId);
      runtimeUiActions.openTerminal({
        endpointId: actionEndpointId,
        topologyRef: actionTopologyRef,
        nodeName: item.name,
        protocol,
        title: `${nodeAccessTitlePrefix(protocol)}: ${item.label || item.name}`
      });
    };

    const openInterfaceImpairments = (): void => {
      if (!actionTopologyRef || !item?.containerName) {
        postExplorerError(uiText("Interface impairments require a running interface item."));
        return;
      }
      const fieldByCommand: Record<string, keyof NetemFields> = {
        "containerlab.interface.setDelay": "delay",
        "containerlab.interface.setJitter": "jitter",
        "containerlab.interface.setLoss": "loss",
        "containerlab.interface.setRate": "rate",
        "containerlab.interface.setCorruption": "corruption"
      };
      runtimeUiActions.openNetem({
        endpointId: actionEndpointId,
        topologyRef: actionTopologyRef,
        nodeName: item.containerName,
        preferredField: fieldByCommand[commandId],
        preferredInterfaceName: item.label || item.name,
        title: uiText("Impairments: {0}", { "0": (item.containerName) })
      });
    };

    const setSessionHostnameFlow = async (): Promise<void> => {
      const actionEndpointLabel =
        findEndpointConfig(endpoints, actionEndpointId)?.label ?? actionEndpointId ?? "default";
      const currentHostname = getSessionHostnameOverride(actionEndpointId) ?? "";
      const rawValue = await promptForTextInput({
        title: uiText("Session Hostname Override"),
        message: uiText("Set the session hostname override for packet capture on \"{0}\". Leave empty to clear it.", { "0": (actionEndpointLabel) }),
        label: uiText("Hostname override"),
        defaultValue: currentHostname,
        confirmLabel: uiText("Save"),
        allowEmpty: true
      });
      if (rawValue === undefined) {
        return;
      }
      const nextValue = setSessionHostnameOverride(rawValue, actionEndpointId);
      runtimeUiActions.notify(
        nextValue
          ? uiText("Session hostname override for \"{0}\" set to \"{1}\".", { "0": (actionEndpointLabel), "1": (nextValue) })
          : uiText("Session hostname override for \"{0}\" cleared.", { "0": (actionEndpointLabel) }),
        "success"
      );
    };

    const copyText = async (value: string | undefined): Promise<void> => {
      if (value) {
        await navigator.clipboard.writeText(value).catch(() => {});
      }
    };

    const requireFileEndpointId = (): string | undefined => {
      const endpointId = item?.endpointId ?? actionEndpointId;
      if (!endpointId) {
        postExplorerError(uiText("No endpoint is associated with this file item."));
        return undefined;
      }
      return endpointId;
    };

    const requireFilePath = (): string | undefined => {
      const pathValue = item?.resourcePath;
      if (typeof pathValue !== "string" || pathValue.trim().length === 0) {
        postExplorerError(uiText("No file path is associated with this item."));
        return undefined;
      }
      return pathValue;
    };

    const selectedDirectoryPath = (): string => {
      if (item?.resourceKind === "directory") {
        return item.resourcePath ?? "";
      }
      return fileParentPath(item?.resourcePath ?? "");
    };

    const promptWorkspacePath = async (
      title: string,
      defaultPath: string
    ): Promise<string | undefined> => {
      const rawValue = await promptForTextInput({
        title,
        message: uiText("Enter a path under the lab workspace."),
        label: uiText("Path"),
        defaultValue: defaultPath,
        confirmLabel: title.startsWith("Rename") ? uiText("Rename") : uiText("Create")
      });
      if (rawValue === undefined) {
        return undefined;
      }
      const normalized = normalizePathValue(rawValue);
      return normalized.length > 0 ? normalized : undefined;
    };

    const openFileEditor = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      const pathValue = requireFilePath();
      if (!endpointId || !pathValue) {
        return;
      }
      const document = await readFileExplorerFile(endpointId, pathValue);
      await options.openFileEditor({
        ...document,
        title: safeFilename(pathValue)
      });
    };

    const createWorkspaceFile = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      if (!endpointId) {
        return;
      }
      const parentPath = selectedDirectoryPath();
      const pathValue = await promptWorkspacePath(
        "New file path",
        joinWorkspacePath(parentPath, "untitled.txt")
      );
      if (!pathValue) {
        return;
      }
      await writeFileExplorerFile({ endpointId, path: pathValue, content: "" });
      refreshWorkspaceAfterMutation(endpointId);
      await options.openFileEditor({
        endpointId,
        path: pathValue,
        content: "",
        title: safeFilename(pathValue)
      });
      runtimeUiActions.notify(uiText("Created {0}", { "0": (pathValue) }), "success");
      scheduleSnapshot(0);
    };

    const createWorkspaceFolder = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      if (!endpointId) {
        return;
      }
      const parentPath = selectedDirectoryPath();
      const pathValue = await promptWorkspacePath(
        "New folder path",
        joinWorkspacePath(parentPath, "new-folder")
      );
      if (!pathValue) {
        return;
      }
      await createFileExplorerDirectory(endpointId, pathValue);
      refreshWorkspaceAfterMutation(endpointId);
      runtimeUiActions.notify(uiText("Created {0}", { "0": (pathValue) }), "success");
    };

    const renameWorkspaceItem = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      const oldPath = requireFilePath();
      if (!endpointId || !oldPath) {
        return;
      }
      const newPath = await promptWorkspacePath("Rename path", oldPath);
      if (!newPath || newPath === oldPath) {
        return;
      }
      if (isSharedWorkspacePath(oldPath) !== isSharedWorkspacePath(newPath)) {
        postExplorerError(uiText("Files cannot be moved between personal and shared workspaces."));
        return;
      }
      await renameFileExplorerPath({ endpointId, oldPath, newPath });
      refreshWorkspaceAfterMutation(endpointId);
      runtimeUiActions.notify(uiText("Renamed {0} to {1}", { "0": (oldPath), "1": (newPath) }), "success");
    };

    const deleteWorkspaceItem = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      const pathValue = requireFilePath();
      if (!endpointId || !pathValue) {
        return;
      }
      const isDirectory = item?.resourceKind === "directory";
      const kind = isDirectory ? "folder" : "file";
      const suffix = isDirectory ? uiText(" and everything inside it") : "";
      const confirmed = await confirmRuntimeAction({
        title: uiText("Delete {0}", { "0": (kind) }),
        message: uiText("Delete {0} \"Lab workspace/{1}\"{2}?", { "0": (kind), "1": (pathValue), "2": (suffix) }),
        confirmLabel: uiText("Delete"),
        severity: "error"
      });
      if (!confirmed) {
        return;
      }
      await deleteFileExplorerPath(endpointId, pathValue, {
        recursive: isDirectory
      });
      refreshWorkspaceAfterMutation(endpointId);
      runtimeUiActions.notify(uiText("Deleted {0}", { "0": (pathValue) }), "success");
    };

    const copyWorkspacePath = async (): Promise<void> => {
      const pathValue = requireFilePath();
      if (!pathValue) {
        return;
      }
      await copyText(pathValue);
      runtimeUiActions.notify(uiText("Copied path for {0}.", { "0": (pathValue) }), "success");
    };

    const downloadWorkspaceFile = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      const pathValue = requireFilePath();
      if (!endpointId || !pathValue) {
        return;
      }
      const download = await downloadFileExplorerFile(endpointId, pathValue);
      triggerBlobDownload(download.filename, download.blob);
      runtimeUiActions.notify(uiText("Downloaded {0}.", { "0": (pathValue) }), "success");
    };

    const uploadWorkspaceFile = async (): Promise<void> => {
      const endpointId = requireFileEndpointId();
      if (!endpointId) {
        return;
      }
      const files = await pickTransferFiles("", item?.resourceKind !== "file");
      if (files.length === 0) {
        return;
      }
      if (item?.resourceKind === "file") {
        const file = files[0];
        const targetPath = item.resourcePath ?? "";
        if (!targetPath) {
          postExplorerError(uiText("No upload target path is available."));
          return;
        }
        const confirmed = await confirmRuntimeAction({
          title: uiText("Replace File"),
          message: uiText("Replace \"Lab workspace/{0}\" with \"{1}\"?", { "0": (targetPath), "1": (file.name) }),
          confirmLabel: "Replace",
          severity: "warning"
        });
        if (!confirmed) {
          return;
        }
        await uploadFileExplorerFile({
          endpointId,
          file,
          path: targetPath,
          targetKind: "file"
        });
        refreshWorkspaceAfterMutation(endpointId);
        runtimeUiActions.notify(uiText("Uploaded {0}.", { "0": (targetPath) }), "success");
        return;
      }

      const directoryPath = selectedDirectoryPath();
      await uploadFileExplorerFile({
        endpointId,
        files,
        path: directoryPath,
        targetKind: "directory"
      });
      refreshWorkspaceAfterMutation(endpointId);
      runtimeUiActions.notify(
        uiText("Uploaded {0} file{1} to lab workspace{2}.", { "0": (files.length), "1": (files.length === 1 ? "" : "s"), "2": (directoryPath ? `/${directoryPath}` : "") }),
        "success"
      );
    };

    const downloadLabArchiveFlow = async (): Promise<void> => {
      const endpointId = await resolveEndpointForAction("download a lab archive", actionEndpointId);
      if (!endpointId) {
        return;
      }
      const labFolder = resolveArchiveLabFolder({
        item,
        topologyRef: resolveActionTopologyRef(),
        targetLabel
      });
      if (!labFolder) {
        postExplorerError(uiText("Select a lab folder before downloading an archive."));
        return;
      }
      const format = await promptArchiveFormat();
      if (!format) {
        return;
      }
      const download = await downloadLabArchive({
        endpointId,
        format,
        path: labFolder
      });
      triggerBlobDownload(download.filename, download.blob);
      runtimeUiActions.notify(uiText("Downloaded archive for {0}.", { "0": (labFolder) }), "success");
    };

    const commandHandlers: Record<string, () => Promise<void> | void> = {
      "containerlab.openLink": () => {
        const link = typeof args[0] === "string" ? args[0] : undefined;
        if (link) {
          window.open(link, "_blank", "noopener,noreferrer");
        }
      },
      "containerlab.endpoint.add": () => dispatchEndpointUiAction({ action: "add" }),
      "containerlab.endpoint.reconnect": () =>
        actionEndpointId
          ? dispatchEndpointUiAction({
              action: "reconnect",
              endpointId: actionEndpointId
            })
          : postExplorerError(uiText("No endpoint is associated with this item.")),
      "containerlab.endpoint.remove": () =>
        actionEndpointId
          ? dispatchEndpointUiAction({
              action: "remove",
              endpointId: actionEndpointId
            })
          : postExplorerError(uiText("No endpoint is associated with this item.")),
      "containerlab.endpoint.copyUrl": async () => {
        const endpoint = findEndpointConfig(endpoints, actionEndpointId);
        if (!actionEndpointId || !endpoint) {
          postExplorerError(
            actionEndpointId
              ? uiText("Endpoint metadata is not available.")
              : uiText("No endpoint is associated with this item.")
          );
          return;
        }
        await navigator.clipboard.writeText(endpoint.url).catch(() => {});
        runtimeUiActions.notify(uiText("Copied endpoint URL for {0}.", { "0": (endpoint.label) }), "success");
      },
      "containerlab.file.open": openFileEditor,
      "containerlab.file.openTopology": openFileEditor,
      "containerlab.file.newFile": createWorkspaceFile,
      "containerlab.file.newFolder": createWorkspaceFolder,
      "containerlab.file.rename": renameWorkspaceItem,
      "containerlab.file.delete": deleteWorkspaceItem,
      "containerlab.file.copyPath": copyWorkspacePath,
      "containerlab.file.download": downloadWorkspaceFile,
      "containerlab.file.upload": uploadWorkspaceFile,
      "containerlab.file.downloadArchive": downloadLabArchiveFlow,
      "containerlab.file.refresh": () => {
        refreshWorkspaceAfterMutation(actionEndpointId);
      },
      "containerlab.install.edgeshark": () => runEndpointEdgeSharkAction("install"),
      "containerlab.uninstall.edgeshark": () => runEndpointEdgeSharkAction("uninstall"),
      "containerlab.lab.graph.topoViewer": openTopologyFile,
      "containerlab.lab.openFile": openTopologyFile,
      "containerlab.editor.topoViewerEditor.open": openTopologyFile,
      "containerlab.lab.graph.drawio.horizontal": () => runDrawio("horizontal"),
      "containerlab.lab.graph.drawio.vertical": () => runDrawio("vertical"),
      "containerlab.lab.graph.drawio.interactive": () => runDrawio("interactive"),
      "containerlab.editor.topoViewerEditor": createTopologyFileFlow,
      "containerlab.lab.cloneRepo": cloneRepositoryFlow,
      "containerlab.lab.clonePopularRepo": () => clonePopularFlow("undeployed"),
      "containerlab.lab.deployPopular": () =>
        lifecycleActionsAvailable
          ? clonePopularFlow("deploy")
          : runtimeUiActions.notify(uiText("This action is not available."), "warning"),
      "containerlab.images.manage": runtimeUiActions.openImageManager,
      "containerlab.inspectAll": runtimeUiActions.openInspectAll,
      "containerlab.inspectOneLab": () => {
        const topologyRef = requireTopologyRef();
        if (topologyRef) {
          runtimeUiActions.openInspectLab(
            { endpointId: actionEndpointId, topologyRef },
            `Inspect: ${targetLabel ?? topologyRef.labName}`
          );
        }
      },
      "containerlab.lab.deploy": () => runLabLifecycle("deploy", false),
      "containerlab.lab.deploy.specificFile": () => runLabLifecycle("deploy", false),
      "containerlab.lab.deploy.cleanup": async () => {
        const confirmed = await confirmRuntimeAction({
          title: uiText("Deploy With Cleanup"),
          message:
            uiText("Deploy (cleanup) may remove existing lab artifacts before deployment. Continue?"),
          confirmLabel: uiText("Deploy"),
          severity: "warning"
        });
        if (confirmed) {
          await runLabLifecycle("deploy", true);
        }
      },
      "containerlab.lab.destroy": () => runLabLifecycle("destroy", false),
      "containerlab.lab.destroy.cleanup": () => runLabLifecycle("destroy", true),
      "containerlab.lab.redeploy": () => runLabLifecycle("redeploy", false),
      "containerlab.lab.redeploy.cleanup": () => runLabLifecycle("redeploy", true),
      "containerlab.lab.apply": () => runLabLifecycle("apply", false),
      "containerlab.lab.start": () => runLabLifecycle("start"),
      "containerlab.lab.stop": () => runLabLifecycle("stop"),
      "containerlab.lab.restart": () => runLabLifecycle("restart"),
      "containerlab.lab.save": async () => {
        const topologyRef = requireTopologyRef();
        if (topologyRef) {
          await saveConfigsFlow(
            { endpointId: actionEndpointId, topologyRef },
            `Saved configs for ${topologyRef.labName}.`
          );
        }
      },
      "containerlab.lab.delete": deleteTopologyFlow,
      "containerlab.lab.downloadArchive": downloadLabArchiveFlow,
      "containerlab.lab.toggleFavorite": toggleFavoriteFlow,
      "containerlab.lab.sshToAllNodes": openSshToAllNodes,
      "containerlab.lab.sshx.attach": () => runShareAction("sshx", "attach"),
      "containerlab.lab.sshx.detach": () => runShareAction("sshx", "detach"),
      "containerlab.lab.sshx.reattach": () => runShareAction("sshx", "reattach"),
      "containerlab.lab.gotty.attach": () => runShareAction("gotty", "attach"),
      "containerlab.lab.gotty.detach": () => runShareAction("gotty", "detach"),
      "containerlab.lab.gotty.reattach": () => runShareAction("gotty", "reattach"),
      "containerlab.lab.sshx.copyLink": () => copyShareLink("sshx"),
      "containerlab.lab.sshx.copylink": () => copyShareLink("sshx"),
      "containerlab.lab.gotty.copyLink": () => copyShareLink("gotty"),
      "containerlab.lab.gotty.copylink": () => copyShareLink("gotty"),
      "containerlab.lab.fcli.bgpPeers": () => runFcli("bgp-peers"),
      "containerlab.lab.fcli.bgpRib": () => runFcli("bgp-rib"),
      "containerlab.lab.fcli.ipv4Rib": () => runFcli("ipv4-rib"),
      "containerlab.lab.fcli.lldp": () => runFcli("lldp"),
      "containerlab.lab.fcli.mac": () => runFcli("mac"),
      "containerlab.lab.fcli.ni": () => runFcli("ni"),
      "containerlab.lab.fcli.subif": () => runFcli("subif"),
      "containerlab.lab.fcli.sysInfo": () => runFcli("sys-info"),
      "containerlab.lab.fcli.custom": async () => {
        const customCommand = await promptForTextInput({
          title: uiText("Custom fcli Command"),
          label: uiText("fcli command"),
          defaultValue: "bgp-peers",
          confirmLabel: uiText("Run")
        });
        if (customCommand?.trim()) {
          await runFcli(customCommand.trim());
        }
      },
      "containerlab.capture.killAllWiresharkVNC": async () => {
        const endpointId = await resolveEndpointForAction(
          "close all Wireshark VNC sessions",
          actionEndpointId
        );
        if (
          endpointId &&
          (await confirmRuntimeAction({
            title: uiText("Close Wireshark VNC Sessions"),
            message: uiText("Close all active Wireshark VNC sessions for this endpoint?"),
            confirmLabel: uiText("Close Sessions"),
            severity: "warning"
          }))
        ) {
          try {
            const response = await closeAllWiresharkVncSessions(endpointId);
            runtimeUiActions.notify(
              response.message || "Closed Wireshark VNC sessions.",
              "success"
            );
          } catch (error) {
            runtimeUiActions.notify(
              error instanceof Error ? error.message : String(error),
              "error"
            );
          }
        }
      },
      "containerlab.treeView.runningLabs.hideNonOwnedLabs": () => {
        explorerPreferences.showNonOwnedLabs = false;
        persistShowNonOwnedLabsSetting(false);
        scheduleSnapshot(0);
      },
      "containerlab.treeView.runningLabs.showNonOwnedLabs": () => {
        explorerPreferences.showNonOwnedLabs = true;
        persistShowNonOwnedLabsSetting(true);
        scheduleSnapshot(0);
      },
      "containerlab.node.save": async () => {
        if (!actionTopologyRef || !item?.name) {
          postExplorerError(uiText("Node save requires a running lab item."));
          return;
        }
        await saveConfigsFlow(
          {
            endpointId: actionEndpointId,
            topologyRef: actionTopologyRef,
            nodeName: item.name
          },
          `Saved config for ${item.label || item.name}.`
        );
      },
      "containerlab.node.start": () =>
        runNodeLifecycle("start", `Started ${item?.label || item?.name || "node"}.`),
      "containerlab.node.stop": () =>
        runNodeLifecycle("stop", `Stopped ${item?.label || item?.name || "node"}.`),
      "containerlab.node.restart": () =>
        runNodeLifecycle("restart", `Restarted ${item?.label || item?.name || "node"}.`),
      "containerlab.node.pause": () =>
        runNodeLifecycle("pause", `Paused ${item?.label || item?.name || "node"}.`),
      "containerlab.node.unpause": () =>
        runNodeLifecycle("unpause", `Unpaused ${item?.label || item?.name || "node"}.`),
      "containerlab.node.openBrowser": openNodeBrowser,
      "containerlab.node.ssh": openNodeAccessTerminal,
      "containerlab.node.attachShell": openNodeAccessTerminal,
      "containerlab.node.telnet": openNodeAccessTerminal,
      "containerlab.node.showLogs": () => {
        if (!actionTopologyRef || !item?.name) {
          postExplorerError(uiText("Node logs require a running lab item."));
          return;
        }
        runtimeUiActions.openLogs({
          endpointId: actionEndpointId,
          topologyRef: actionTopologyRef,
          nodeName: item.name,
          title: uiText("Logs: {0}", { "0": (item.label || item.name) })
        });
      },
      "containerlab.node.manageImpairments": () => {
        if (!actionTopologyRef || !item?.name) {
          postExplorerError(uiText("Impairments require a running lab item."));
          return;
        }
        runtimeUiActions.openNetem({
          endpointId: actionEndpointId,
          topologyRef: actionTopologyRef,
          nodeName: item.name,
          title: uiText("Impairments: {0}", { "0": (item.label || item.name) })
        });
      },
      "containerlab.interface.setDelay": openInterfaceImpairments,
      "containerlab.interface.setJitter": openInterfaceImpairments,
      "containerlab.interface.setLoss": openInterfaceImpairments,
      "containerlab.interface.setRate": openInterfaceImpairments,
      "containerlab.interface.setCorruption": openInterfaceImpairments,
      "containerlab.interface.capture": () => runPreferredCapture(),
      "containerlab.interface.captureWithEdgeshark": () => runPacketflixCapture(),
      "containerlab.interface.captureWithEdgesharkVNC": () => runWiresharkVncCapture(),
      "containerlab.node.captureInterfaces": openNodeCaptureDialog,
      "containerlab.set.sessionHostname": setSessionHostnameFlow,
      "containerlab.node.copyName": () => copyText(item?.name || item?.label),
      "containerlab.node.copyID": () => copyText(item?.cID),
      "containerlab.node.copyKind": () => copyText(item?.kind),
      "containerlab.node.copyImage": () => copyText(item?.image),
      "containerlab.node.copyIPv4Address": () => copyText(item?.v4Address),
      "containerlab.node.copyIPv6Address": () => copyText(item?.v6Address),
      "containerlab.interface.copyMACAddress": () => copyText(item?.mac),
      "containerlab.lab.copyPath": async () =>
        copyText(actionTopologyRef?.yamlPath ?? (await options.resolveApiTopologyPath(args)))
    };

    const handler = commandHandlers[commandId];
    if (handler) {
      await handler();
      return;
    }

    if (!unhandledCommands.has(commandId)) {
      unhandledCommands.add(commandId);
      console.warn(`[Standalone] Command not implemented: ${commandId}`);
    }
  };
}
