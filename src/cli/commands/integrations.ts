import type { Command } from "commander";

import { readConfig } from "@/cli/helpers.js";
import {
  getEnabledIntegrations,
  getIntegration,
  listIntegrations,
} from "@/integrations/registry.js";

export function registerIntegrationCommands(program: Command): void {
  const integrations = program.command("integrations").description("Inspect integration plugins");

  integrations
    .command("list")
    .description("List built-in integrations")
    .action(() => {
      const config = readConfig({ silent: true });
      const enabled = new Set(getEnabledIntegrations(config).map((integration) => integration.id));
      process.stdout.write(
        `${JSON.stringify(
          listIntegrations().map((integration) => ({
            id: integration.id,
            displayName: integration.displayName,
            version: integration.version,
            enabled: enabled.has(integration.id),
            capabilities: integration.capabilities,
          })),
          null,
          2
        )}\n`
      );
    });

  integrations
    .command("show")
    .description("Show one integration")
    .argument("<id>", "Integration ID")
    .action((id: string) => {
      const integration = getIntegration(id);
      if (!integration) {
        process.stderr.write(`Unknown integration: ${id}\n`);
        process.exit(2);
      }

      process.stdout.write(`${JSON.stringify(integration, null, 2)}\n`);
    });

  integrations
    .command("check")
    .description("Validate all enabled integrations")
    .action(() => {
      const config = readConfig({ silent: true });
      const results = getEnabledIntegrations(config).map((integration) => ({
        id: integration.id,
        ...(integration.validateConfig?.(config) ?? { ok: true, warnings: [], errors: [] }),
      }));
      process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    });

  integrations
    .command("doctor")
    .description("Explain the health of an integration")
    .argument("<id>", "Integration ID")
    .action((id: string) => {
      const integration = getIntegration(id);
      if (!integration) {
        process.stderr.write(`Unknown integration: ${id}\n`);
        process.exit(2);
      }

      const config = readConfig({ silent: true });
      const health = integration.validateConfig?.(config) ?? { ok: true, warnings: [], errors: [] };
      process.stdout.write(
        `${JSON.stringify(
          {
            id,
            ok: health.ok,
            warnings: health.warnings,
            errors: health.errors,
            eventAuditEnabled: config.eventAudit?.enabled ?? true,
          },
          null,
          2
        )}\n`
      );
    });
}
