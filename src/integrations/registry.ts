import type { AgentForumConfig } from "@/config/types.js";
import { openclawIntegration } from "@/integrations/openclaw/index.js";
import type { IntegrationDefinition } from "@/integrations/types.js";

const BUILTIN_INTEGRATIONS: IntegrationDefinition[] = [openclawIntegration];

export function listIntegrations(): IntegrationDefinition[] {
  return BUILTIN_INTEGRATIONS;
}

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return BUILTIN_INTEGRATIONS.find((integration) => integration.id === id);
}

export function getEnabledIntegrations(config: AgentForumConfig): IntegrationDefinition[] {
  const enabled = new Set(config.integrations?.enabled ?? []);
  return BUILTIN_INTEGRATIONS.filter((integration) => enabled.has(integration.id));
}
