import type { AgentForumConfig } from "@/config/types.js";
import { BUILTIN_PRESETS } from "@/output/presets.js";
import type { IntegrationDefinition, IntegrationHealth } from "@/integrations/types.js";

function validateConfig(config: AgentForumConfig): IntegrationHealth {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.eventAudit?.enabled) {
    errors.push("eventAudit.enabled must be true for OpenClaw integrations.");
  }

  if (!config.integrations?.openclaw?.actorMappings) {
    warnings.push(
      "No integrations.openclaw.actorMappings configured; actor mapping will rely on runtime defaults."
    );
  }

  return { ok: errors.length === 0, warnings, errors };
}

export const openclawIntegration: IntegrationDefinition = {
  id: "openclaw",
  displayName: "OpenClaw",
  version: "1.0.0",
  capabilities: [
    "identity-mapping",
    "event-consumption",
    "metadata-annotation",
    "preset:openclaw-analysis",
  ],
  contributePresets: () => [BUILTIN_PRESETS["openclaw-analysis"]],
  validateConfig,
};
