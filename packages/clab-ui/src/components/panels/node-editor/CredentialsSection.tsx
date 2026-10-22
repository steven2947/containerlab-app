import { uiText } from "../../../i18n";
// Login credentials (`credentials`) of a node.
import React from "react";

import { InputField, PanelSection } from "../../ui/form";
import type { NodeCredentials } from "../../../core/parsing/NodeCredentials";

import type { TabProps } from "./types";

const LEVEL_LABELS: Record<string, string> = {
  defaults: uiText("topology defaults"),
  kind: uiText("kind settings"),
  group: uiText("group settings")
};

function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== "";
}

/** Note under the username and password, saying where the login comes from */
function describeLogin(ownLogin: boolean, inheritedSource: string | undefined): string {
  if (inheritedSource === undefined) {
    return uiText("Used for SSH logins and the generated inventories. Empty fields use the kind default.");
  }
  if (ownLogin) {
    return uiText("Replaces the login from the {0} as a whole. Empty fields use the kind default.", { "0": (levelLabel(inheritedSource)) });
  }
  return uiText("Inherited from the {0}. Typing here sets a login for this node only.", { "0": (levelLabel(inheritedSource)) });
}

export const CredentialsSection: React.FC<TabProps> = ({ data, onChange }) => {
  if (data.isCustomTemplate === true) return null;

  const own = data.credentials ?? {};
  const inherited = data.inheritedCredentials ?? {};
  const ownLogin = isSet(own.username) || isSet(own.password);
  const fallback = ownLogin ? {} : inherited;
  const inheritsIdentityFile =
    !isSet(own.identityFile) && inherited.identityFileSource !== undefined;

  const update = (patch: Partial<NodeCredentials>) => {
    onChange({ credentials: { ...own, ...patch } });
  };

  return (
    <PanelSection title={uiText("Login Credentials")}>
      <InputField
        id="node-credentials-username"
        label={uiText("Username")}
        value={own.username ?? ""}
        onChange={(value) => update({ username: value })}
        placeholder={fallback.username ?? uiText("Kind default")}
      />
      <InputField
        id="node-credentials-password"
        label={uiText("Password")}
        type="password"
        value={own.password ?? ""}
        onChange={(value) => update({ password: value })}
        placeholder={isSet(fallback.password) ? uiText("Inherited password") : uiText("Kind default")}
        helperText={describeLogin(ownLogin, inherited.source)}
      />
      <InputField
        id="node-credentials-identity-file"
        label={uiText("SSH Identity File")}
        value={own.identityFile ?? ""}
        onChange={(value) => update({ identityFile: value })}
        placeholder={inherited.identityFile ?? "~/.ssh/id_ed25519"}
        helperText={
          inheritsIdentityFile
            ? uiText("Inherited from the {0}", { "0": (levelLabel(inherited.identityFileSource ?? "")) })
            : uiText("Private key for SSH. A relative path starts at the topology folder.")
        }
      />
    </PanelSection>
  );
};
