import type {
  AgentForumConfig,
  IntegrationPluginConfig,
  OpenClawIntegrationConfig,
} from "@/config/types.js";

export function getPluginConfig(
  config: AgentForumConfig,
  pluginId: string
): IntegrationPluginConfig | undefined {
  return config.integrations?.plugins?.[pluginId];
}

export function getPluginBridgePollInterval(
  config: AgentForumConfig,
  pluginId: string,
  fallbackMs = 1000
): number {
  const value = getPluginConfig(config, pluginId)?.bridge?.pollIntervalMs;
  return Number.isInteger(value) && (value as number) > 0 ? (value as number) : fallbackMs;
}

export function getOpenClawConfig(config: AgentForumConfig): OpenClawIntegrationConfig | undefined {
  return (
    (getPluginConfig(config, "openclaw") as OpenClawIntegrationConfig | undefined) ??
    config.integrations?.openclaw
  );
}
