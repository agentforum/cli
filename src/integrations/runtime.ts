import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
import { createIntegrationApi } from "@/integrations/api.js";
import { getPluginBridgePollInterval } from "@/integrations/config.js";
import type {
  IntegrationBridgeInput,
  IntegrationDefinition,
  IntegrationIngestInput,
  IntegrationIngestResult,
  IntegrationNotification,
  IntegrationResolveIdentityInput,
} from "@/integrations/types.js";
import { getIntegration, isIntegrationEnabled } from "@/integrations/registry.js";
import {
  IntegrationCursorRepository,
  IntegrationOperationRepository,
} from "@/store/repositories/integration-state.repo.js";

function normalizeOperationKey(operationKey: string | undefined): string | undefined {
  if (operationKey == null) {
    return undefined;
  }
  if (typeof operationKey !== "string") {
    throw new AgentForumError("operationKey must be a string.", 3);
  }
  const normalized = operationKey.trim();
  if (!normalized) {
    throw new AgentForumError("operationKey must not be empty.", 3);
  }
  if (normalized.length > 256) {
    throw new AgentForumError("operationKey must be 256 characters or fewer.", 3);
  }
  return normalized;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function buildOperationFingerprint(input: IntegrationIngestInput): string {
  return stableSerialize({
    action: input.action,
    identity: input.identity ?? null,
    payload: input.payload ?? null,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateIntegrationIdentity(
  integrationId: string,
  identity: unknown
): asserts identity is {
  actor: string | null;
  session: string | null;
  metadata?: Record<string, unknown>;
} {
  if (!isRecord(identity)) {
    throw new AgentForumError(
      `Integration ${integrationId} returned an invalid identity object.`,
      3
    );
  }
  if (!(typeof identity.actor === "string" || identity.actor === null)) {
    throw new AgentForumError(
      `Integration ${integrationId} returned an invalid identity.actor.`,
      3
    );
  }
  if (!(typeof identity.session === "string" || identity.session === null)) {
    throw new AgentForumError(
      `Integration ${integrationId} returned an invalid identity.session.`,
      3
    );
  }
  if ("metadata" in identity && !(identity.metadata == null || isRecord(identity.metadata))) {
    throw new AgentForumError(
      `Integration ${integrationId} returned invalid identity.metadata.`,
      3
    );
  }
}

function validateNotifications(
  integrationId: string,
  notifications: unknown
): asserts notifications is IntegrationNotification[] {
  if (!Array.isArray(notifications)) {
    throw new AgentForumError(
      `Integration ${integrationId} returned invalid bridge notifications.`,
      3
    );
  }
  for (const notification of notifications) {
    if (!isRecord(notification)) {
      throw new AgentForumError(
        `Integration ${integrationId} returned invalid bridge notifications.`,
        3
      );
    }
    if (typeof notification.kind !== "string" || typeof notification.reason !== "string") {
      throw new AgentForumError(
        `Integration ${integrationId} returned invalid bridge notifications.`,
        3
      );
    }
    if (
      "targetActor" in notification &&
      !(typeof notification.targetActor === "string" || notification.targetActor === null)
    ) {
      throw new AgentForumError(
        `Integration ${integrationId} returned invalid bridge notifications.`,
        3
      );
    }
    if (
      "targetSession" in notification &&
      !(typeof notification.targetSession === "string" || notification.targetSession === null)
    ) {
      throw new AgentForumError(
        `Integration ${integrationId} returned invalid bridge notifications.`,
        3
      );
    }
    if (!isRecord(notification.payload)) {
      throw new AgentForumError(
        `Integration ${integrationId} returned invalid bridge notifications.`,
        3
      );
    }
  }
}

function validateIngestResult(
  integrationId: string,
  result: unknown
): asserts result is IntegrationIngestResult {
  if (!isRecord(result) || typeof result.action !== "string") {
    throw new AgentForumError(`Integration ${integrationId} returned an invalid ingest result.`, 3);
  }
  if ("identity" in result && result.identity != null) {
    validateIntegrationIdentity(integrationId, result.identity);
  }
  if ("notifications" in result && result.notifications != null) {
    validateNotifications(integrationId, result.notifications);
  }
}

function getEnabledIntegration(config: AgentForumConfig, id: string): IntegrationDefinition {
  const integration = getIntegration(id);
  if (!integration) {
    throw new AgentForumError(`Unknown integration: ${id}`, 2);
  }
  if (!isIntegrationEnabled(id, config)) {
    throw new AgentForumError(`Integration ${id} is not enabled in config.`, 3);
  }
  return integration;
}

export function resolveIntegrationIdentity(
  config: AgentForumConfig,
  integrationId: string,
  input: IntegrationResolveIdentityInput
) {
  const integration = getEnabledIntegration(config, integrationId);
  if (!integration.resolveIdentity) {
    throw new AgentForumError(
      `Integration ${integrationId} does not implement identity resolution.`,
      3
    );
  }
  const resolved = integration.resolveIdentity(input, createIntegrationApi(config), config);
  validateIntegrationIdentity(integrationId, resolved);
  return resolved;
}

export async function runIntegrationIngest(
  config: AgentForumConfig,
  integrationId: string,
  input: IntegrationIngestInput
): Promise<IntegrationIngestResult> {
  const integration = getEnabledIntegration(config, integrationId);
  if (!integration.ingest) {
    throw new AgentForumError(`Integration ${integrationId} does not implement ingest.`, 3);
  }

  const operations = new IntegrationOperationRepository(config);
  const operationKey = normalizeOperationKey(input.operationKey);
  const requestJson = buildOperationFingerprint(input);
  if (operationKey) {
    const existing = operations.findByKey(integrationId, operationKey);
    if (existing) {
      if (existing.action !== input.action || existing.requestJson !== requestJson) {
        throw new AgentForumError(
          `operationKey ${operationKey} for integration ${integrationId} was already used for a different request.`,
          3
        );
      }
      const stored = JSON.parse(existing.resultJson) as IntegrationIngestResult;
      return {
        ...stored,
        operationKey,
        replayed: true,
      };
    }
  }

  const result = await integration.ingest(input, createIntegrationApi(config), config);
  validateIngestResult(integrationId, result);
  if (operationKey) {
    const now = new Date().toISOString();
    operations.save({
      integrationId,
      operationKey,
      action: input.action,
      requestJson,
      resultJson: JSON.stringify({ ...result, operationKey, replayed: false }),
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    ...result,
    operationKey,
    replayed: false,
  };
}

export function deriveConsumerKey(
  integrationId: string,
  identity: IntegrationResolveIdentityInput
): string {
  const actor = typeof identity.actor === "string" ? identity.actor.trim() : "";
  const session = typeof identity.session === "string" ? identity.session.trim() : "";
  const agentId = typeof identity.agentId === "string" ? identity.agentId.trim() : "";
  const sessionKey = typeof identity.sessionKey === "string" ? identity.sessionKey.trim() : "";
  return `${integrationId}:${actor || agentId || "unknown"}:${session || sessionKey || "default"}`;
}

export interface IntegrationBridgeOptions {
  identity: IntegrationResolveIdentityInput;
  consumerKey?: string;
  afterId?: string;
  limit?: number;
}

export interface BridgeBatchResult {
  notifications: IntegrationNotification[];
  lastEventId: string | null;
  consumerKey: string;
}

export async function readIntegrationBridgeBatch(
  config: AgentForumConfig,
  integrationId: string,
  options: IntegrationBridgeOptions
): Promise<BridgeBatchResult> {
  const integration = getEnabledIntegration(config, integrationId);
  if (!integration.onForumEvent) {
    throw new AgentForumError(`Integration ${integrationId} does not implement event bridging.`, 3);
  }
  if (!config.eventAudit?.enabled) {
    throw new AgentForumError("Event audit is disabled in config.", 3);
  }

  const api = createIntegrationApi(config);
  const cursorRepo = new IntegrationCursorRepository(config);
  const consumerKey = options.consumerKey ?? deriveConsumerKey(integrationId, options.identity);
  const persistedCursor = options.afterId ? null : cursorRepo.find(integrationId, consumerKey);
  const persistCursor = options.afterId == null;
  let lastSeenId = options.afterId ?? persistedCursor?.lastEventId ?? undefined;
  const notifications: IntegrationNotification[] = [];

  for (const event of api.listEvents({ afterId: lastSeenId })) {
    lastSeenId = event.id;
    const emitted = await integration.onForumEvent(
      { event, identity: options.identity } satisfies IntegrationBridgeInput,
      api,
      config
    );
    validateNotifications(integrationId, emitted ?? []);
    notifications.push(...(emitted ?? []));
    if (persistCursor) {
      const now = new Date().toISOString();
      cursorRepo.save({
        integrationId,
        consumerKey,
        lastEventId: event.id,
        createdAt: persistedCursor?.createdAt ?? now,
        updatedAt: now,
      });
    }
    if (options.limit && notifications.length >= options.limit) {
      return {
        notifications: notifications.slice(0, options.limit),
        lastEventId: lastSeenId,
        consumerKey,
      };
    }
  }

  return { notifications, lastEventId: lastSeenId ?? null, consumerKey };
}

export function getIntegrationBridgePollInterval(
  config: AgentForumConfig,
  integrationId: string
): number {
  return getPluginBridgePollInterval(config, integrationId, 1000);
}
