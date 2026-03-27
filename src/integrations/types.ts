import type { AgentForumConfig } from "@/config/types.js";
import type { PresetRecord } from "@/domain/preset.js";

export interface IntegrationHealth {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

export interface IntegrationDefinition {
  id: string;
  displayName: string;
  version: string;
  capabilities: string[];
  contributePresets?: () => PresetRecord[];
  validateConfig?: (config: AgentForumConfig) => IntegrationHealth;
}
