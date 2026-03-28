import type { Command } from "commander";

import { handleError, readConfig } from "@/cli/helpers.js";
import { AgentForumError } from "@/domain/errors.js";
import {
  getIntegrationBridgePollInterval,
  readIntegrationBridgeBatch,
  resolveIntegrationIdentity,
  runIntegrationIngest,
} from "@/integrations/runtime.js";
import {
  getEnabledIntegrations,
  getIntegration,
  isIntegrationEnabled,
  listIntegrations,
} from "@/integrations/registry.js";
import { getPluginBridgePollInterval, getPluginConfig } from "@/integrations/config.js";
import type {
  IntegrationDefinition,
  IntegrationResolveIdentityInput,
} from "@/integrations/types.js";
import {
  IntegrationCursorRepository,
  IntegrationOperationRepository,
} from "@/store/repositories/integration-state.repo.js";

function validateIntegrationHealth(
  integrationId: string,
  health: unknown
): asserts health is { ok: boolean; warnings: string[]; errors: string[] } {
  if (
    !health ||
    typeof health !== "object" ||
    !("ok" in health) ||
    typeof (health as { ok: unknown }).ok !== "boolean" ||
    !("warnings" in health) ||
    !Array.isArray((health as { warnings: unknown }).warnings) ||
    !(health as { warnings: unknown[] }).warnings.every((item) => typeof item === "string") ||
    !("errors" in health) ||
    !Array.isArray((health as { errors: unknown }).errors) ||
    !(health as { errors: unknown[] }).errors.every((item) => typeof item === "string")
  ) {
    throw new AgentForumError(`Integration ${integrationId} returned invalid health data.`, 3);
  }
}

function parseJsonObject(rawValue: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new AgentForumError(`${label} must be a JSON object.`, 3);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AgentForumError) {
      throw error;
    }
    throw new AgentForumError(`${label} must be valid JSON.`, 3);
  }
}

function summarizeIntegration(integration: IntegrationDefinition, enabled: boolean) {
  return {
    id: integration.id,
    displayName: integration.displayName,
    version: integration.version,
    enabled,
    capabilities: integration.capabilities,
    hooks: {
      validateConfig: Boolean(integration.validateConfig),
      contributePresets: Boolean(integration.contributePresets),
      resolveIdentity: Boolean(integration.resolveIdentity),
      ingest: Boolean(integration.ingest),
      onForumEvent: Boolean(integration.onForumEvent),
    },
  };
}

function buildDoctorReport(
  id: string,
  integration: IntegrationDefinition,
  config: ReturnType<typeof readConfig>
) {
  const enabled = isIntegrationEnabled(id, config);
  const health = integration.validateConfig?.(config) ?? {
    ok: true,
    warnings: [],
    errors: [],
  };
  validateIntegrationHealth(id, health);
  const hooks = summarizeIntegration(integration, enabled).hooks;
  const pluginConfig = getPluginConfig(config, id);
  const operations = new IntegrationOperationRepository(config);
  const cursors = new IntegrationCursorRepository(config);

  return {
    id,
    ok: health.ok,
    enabled,
    warnings: health.warnings,
    errors: health.errors,
    eventAuditEnabled: config.eventAudit?.enabled ?? true,
    hooks,
    bridge: {
      supported: hooks.onForumEvent,
      configured: Boolean(pluginConfig?.bridge),
      pollIntervalMs: getPluginBridgePollInterval(config, id, 1000),
    },
    persistence: {
      operationLogEntries: operations.countForIntegration(id),
      cursorEntries: cursors.countForIntegration(id),
    },
  };
}

function getConfiguredIntegration(id: string): {
  config: ReturnType<typeof readConfig>;
  integration: IntegrationDefinition;
} {
  const config = readConfig({ silent: true });
  const integration = getIntegration(id);
  if (!integration) {
    throw new AgentForumError(`Unknown integration: ${id}`, 2);
  }
  if (!isIntegrationEnabled(id, config)) {
    throw new AgentForumError(`Integration ${id} is not enabled in config.`, 3);
  }
  return { config, integration };
}

export function registerIntegrationCommands(program: Command): void {
  const integrations = program.command("integrations").description("Inspect integration plugins");

  integrations
    .command("list")
    .description("List built-in integrations")
    .action(() => {
      try {
        const config = readConfig({ silent: true });
        const enabled = new Set(
          getEnabledIntegrations(config).map((integration) => integration.id)
        );
        process.stdout.write(
          `${JSON.stringify(
            listIntegrations().map((integration) =>
              summarizeIntegration(integration, enabled.has(integration.id))
            ),
            null,
            2
          )}\n`
        );
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("show")
    .description("Show one integration")
    .argument("<id>", "Integration ID")
    .action((id: string) => {
      try {
        const integration = getIntegration(id);
        if (!integration) {
          process.stderr.write(`Unknown integration: ${id}\n`);
          process.exit(2);
        }

        const config = readConfig({ silent: true });
        process.stdout.write(
          `${JSON.stringify(summarizeIntegration(integration, isIntegrationEnabled(id, config)), null, 2)}\n`
        );
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("check")
    .description("Validate all enabled integrations")
    .action(() => {
      try {
        const config = readConfig({ silent: true });
        const results = getEnabledIntegrations(config).map((integration) => ({
          ...(() => {
            const health = integration.validateConfig?.(config) ?? {
              ok: true,
              warnings: [],
              errors: [],
            };
            validateIntegrationHealth(integration.id, health);
            return { id: integration.id, ...health };
          })(),
        }));
        process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("doctor")
    .description("Explain the health of an integration")
    .argument("<id>", "Integration ID")
    .action((id: string) => {
      try {
        const integration = getIntegration(id);
        if (!integration) {
          process.stderr.write(`Unknown integration: ${id}\n`);
          process.exit(2);
        }

        const config = readConfig({ silent: true });
        process.stdout.write(
          `${JSON.stringify(buildDoctorReport(id, integration, config), null, 2)}\n`
        );
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("resolve")
    .description("Resolve runtime identity through an enabled integration")
    .argument("<id>", "Integration ID")
    .requiredOption("--input <json>", "JSON object with integration identity input")
    .action((id: string, options: { input: string }) => {
      try {
        const { config } = getConfiguredIntegration(id);
        const input = parseJsonObject(options.input, "--input") as IntegrationResolveIdentityInput;
        const resolved = resolveIntegrationIdentity(config, id, input);
        process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("ingest")
    .description("Run an enabled integration ingest action")
    .argument("<id>", "Integration ID")
    .requiredOption("--input <json>", "JSON object with action, identity, and payload")
    .action(async (id: string, options: { input: string }) => {
      try {
        const { config } = getConfiguredIntegration(id);
        const input = parseJsonObject(
          options.input,
          "--input"
        ) as import("@/integrations/types.js").IntegrationIngestInput;
        const result = await runIntegrationIngest(config, id, input);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } catch (error) {
        handleError(error);
      }
    });

  integrations
    .command("bridge")
    .description("Emit integration-specific notifications from audited forum events")
    .argument("<id>", "Integration ID")
    .requiredOption("--identity <json>", "JSON object with runtime identity input")
    .option("--consumer <key>", "Stable consumer key used for persisted bridge cursors")
    .option("--after <eventId>", "Start after a specific audited event")
    .option("--limit <number>", "Limit emitted integration notifications")
    .option("--follow", "Poll for new audited events continuously")
    .action(
      async (
        id: string,
        options: {
          identity: string;
          consumer?: string;
          after?: string;
          limit?: string;
          follow?: boolean;
        }
      ) => {
        try {
          const { config } = getConfiguredIntegration(id);
          const identity = parseJsonObject(
            options.identity,
            "--identity"
          ) as IntegrationResolveIdentityInput;
          let lastSeenId = options.after;
          const limit = options.limit ? Number(options.limit) : undefined;
          if (options.limit && (!Number.isInteger(limit) || limit <= 0)) {
            throw new AgentForumError("--limit must be a positive integer.", 3);
          }
          const pollInterval = getIntegrationBridgePollInterval(config, id);
          let emitted = 0;

          const emitBatch = async () => {
            const batch = await readIntegrationBridgeBatch(config, id, {
              identity,
              consumerKey: options.consumer,
              afterId: lastSeenId,
              limit: limit ? limit - emitted : undefined,
            });
            if (batch.lastEventId) {
              lastSeenId = batch.lastEventId;
            }
            for (const notification of batch.notifications) {
              process.stdout.write(`${JSON.stringify(notification)}\n`);
              emitted += 1;
            }
            return Boolean(limit && emitted >= limit);
          };

          const done = await emitBatch();
          if (done || !options.follow) {
            return;
          }

          while (true) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
            if (await emitBatch()) {
              return;
            }
          }
        } catch (error) {
          handleError(error);
        }
      }
    );
}
