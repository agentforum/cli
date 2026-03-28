import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
import type { AuditEventRecord } from "@/domain/event.js";
import { POST_STATUSES, type PostStatus } from "@/domain/post.js";
import { BUILTIN_PRESETS } from "@/output/presets.js";
import type { IntegrationApi } from "@/integrations/api.js";
import { getOpenClawConfig } from "@/integrations/config.js";
import { getEventRelevance } from "@/integrations/relevance.js";
import type {
  IntegrationBridgeInput,
  IntegrationDefinition,
  IntegrationHealth,
  IntegrationIdentity,
  IntegrationIngestInput,
  IntegrationIngestResult,
  IntegrationNotification,
  IntegrationResolveIdentityInput,
} from "@/integrations/types.js";

function validateConfig(config: AgentForumConfig): IntegrationHealth {
  const openclawConfig = getOpenClawConfig(config);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!config.eventAudit?.enabled) {
    errors.push("eventAudit.enabled must be true for OpenClaw integrations.");
  }

  if (!openclawConfig?.actorMappings) {
    warnings.push(
      "No integrations.plugins.openclaw.actorMappings configured; actor mapping will rely on runtime defaults."
    );
  }

  const pollInterval = openclawConfig?.bridge?.pollIntervalMs;
  if (pollInterval !== undefined && (!Number.isInteger(pollInterval) || pollInterval <= 0)) {
    errors.push("integrations.plugins.openclaw.bridge.pollIntervalMs must be a positive integer.");
  }

  return { ok: errors.length === 0, warnings, errors };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mergeIntegrationMetadata(
  config: AgentForumConfig,
  identity: IntegrationIdentity,
  input: IntegrationResolveIdentityInput,
  existing?: Record<string, unknown> | null
): Record<string, unknown> {
  const integrationMetadata = {
    runtime: "openclaw",
    agentId: asString(input.agentId),
    sessionKey: asString(input.sessionKey) ?? identity.session ?? undefined,
    repo:
      asString(input.repo) ??
      asString(input.sourceRepo) ??
      getOpenClawConfig(config)?.defaultSourceRepo,
    workspace:
      asString(input.workspace) ??
      asString(input.sourceWorkspace) ??
      getOpenClawConfig(config)?.defaultSourceWorkspace,
    source: asString(input.source) ?? "openclaw-runtime",
  };

  return {
    ...(existing ?? {}),
    integration: {
      ...((existing?.integration as Record<string, unknown> | undefined) ?? {}),
      ...Object.fromEntries(
        Object.entries(integrationMetadata).filter(([, value]) => value != null)
      ),
      actor: identity.actor ?? undefined,
      session: identity.session ?? undefined,
    },
  };
}

function resolveIdentity(
  config: AgentForumConfig,
  input: IntegrationResolveIdentityInput
): IntegrationIdentity {
  const explicitActor = asString(input.actor);
  const explicitSession = asString(input.session);
  const agentId = asString(input.agentId);
  const sessionKey = asString(input.sessionKey);
  const mappedActor = agentId ? getOpenClawConfig(config)?.actorMappings?.[agentId] : undefined;
  const actor = explicitActor ?? mappedActor ?? (agentId ? `openclaw:${agentId}` : null);
  const session = explicitSession ?? sessionKey ?? null;

  if (!actor) {
    throw new AgentForumError(
      "OpenClaw identity could not be resolved. Provide actor, agentId, or actorMappings.",
      3
    );
  }

  return {
    actor,
    session,
    metadata: mergeIntegrationMetadata(config, { actor, session }, input, input.metadata ?? null),
  };
}

function requireString(value: unknown, label: string): string {
  const normalized = asString(value);
  if (!normalized) {
    throw new AgentForumError(`${label} is required.`, 3);
  }
  return normalized;
}

function requirePostStatus(value: unknown, label: string): PostStatus {
  const normalized = requireString(value, label);
  if (!POST_STATUSES.includes(normalized as PostStatus)) {
    throw new AgentForumError(`Invalid status: ${normalized}`, 3);
  }
  return normalized as PostStatus;
}

function createNotification(
  event: AuditEventRecord,
  identity: IntegrationIdentity,
  reason: string,
  payload: Record<string, unknown>
): IntegrationNotification {
  return {
    kind: "forum-event",
    reason,
    targetActor: identity.actor,
    targetSession: identity.session,
    payload: {
      eventId: event.id,
      eventType: event.eventType,
      postId: event.postId,
      replyId: event.replyId,
      relationId: event.relationId,
      reactionId: event.reactionId,
      actor: event.actor,
      session: event.session,
      ...payload,
    },
  };
}

function ingest(
  input: IntegrationIngestInput,
  api: IntegrationApi,
  config: AgentForumConfig
): IntegrationIngestResult {
  const payload = input.payload ?? {};
  const identity = resolveIdentity(config, input.identity ?? {});

  switch (input.action) {
    case "create-post": {
      const result = api.createPost({
        channel: requireString(payload.channel, "payload.channel"),
        type: requireString(payload.type, "payload.type"),
        title: requireString(payload.title, "payload.title"),
        body: requireString(payload.body, "payload.body"),
        severity: (payload.severity as "critical" | "warning" | "info" | null | undefined) ?? null,
        tags: Array.isArray(payload.tags)
          ? payload.tags.filter((tag): tag is string => typeof tag === "string")
          : undefined,
        refId: asString(payload.refId) ?? null,
        blocking: payload.blocking === true,
        pinned: payload.pinned === true,
        assignedTo: asString(payload.assignedTo) ?? null,
        idempotencyKey: asString(payload.idempotencyKey) ?? null,
        actor: identity.actor,
        session: identity.session,
        data: mergeIntegrationMetadata(
          config,
          identity,
          input.identity ?? {},
          (payload.data as Record<string, unknown> | null | undefined) ?? null
        ),
      });
      return {
        action: input.action,
        identity,
        duplicated: result.duplicated,
        entity: result.post,
      };
    }
    case "create-reply": {
      const reply = api.createReply({
        postId: requireString(payload.postId, "payload.postId"),
        body: requireString(payload.body, "payload.body"),
        actor: identity.actor,
        session: identity.session,
        data: mergeIntegrationMetadata(
          config,
          identity,
          input.identity ?? {},
          (payload.data as Record<string, unknown> | null | undefined) ?? null
        ),
      });
      return { action: input.action, identity, entity: reply };
    }
    case "assign-post": {
      const post = api.assignPost(
        requireString(payload.postId, "payload.postId"),
        asString(payload.assignedTo) ?? null
      );
      return { action: input.action, identity, entity: post };
    }
    case "resolve-post": {
      const post = api.resolvePost(
        requireString(payload.postId, "payload.postId"),
        requirePostStatus(payload.status, "payload.status"),
        asString(payload.reason),
        identity.actor ?? undefined
      );
      return { action: input.action, identity, entity: post };
    }
    case "create-relation": {
      const relation = api.createRelation({
        fromPostId: requireString(payload.fromPostId, "payload.fromPostId"),
        toPostId: requireString(payload.toPostId, "payload.toPostId"),
        relationType: requireString(payload.relationType, "payload.relationType"),
        actor: identity.actor,
        session: identity.session,
      });
      return { action: input.action, identity, entity: relation };
    }
    case "handoff": {
      const postId = requireString(payload.postId, "payload.postId");
      const assignedTo = requireString(payload.assignedTo, "payload.assignedTo");
      const replyBody =
        asString(payload.body) ?? asString(payload.reason) ?? `Handoff to ${assignedTo}.`;
      const reply = api.createReply({
        postId,
        body: replyBody,
        actor: identity.actor,
        session: identity.session,
        data: mergeIntegrationMetadata(
          config,
          identity,
          input.identity ?? {},
          (payload.data as Record<string, unknown> | null | undefined) ?? null
        ),
      });
      const post = api.assignPost(postId, assignedTo);
      const entities: Record<string, unknown> = { post, reply };

      if (payload.relatedPostId) {
        const relation = api.createRelation({
          fromPostId: postId,
          toPostId: requireString(payload.relatedPostId, "payload.relatedPostId"),
          relationType: asString(payload.relationType) ?? "depends-on",
          actor: identity.actor,
          session: identity.session,
        });
        entities.relation = relation;
      }

      return { action: input.action, identity, entity: post, entities };
    }
    default:
      throw new AgentForumError(`Unsupported OpenClaw action: ${input.action}`, 3);
  }
}

function onForumEvent(
  input: IntegrationBridgeInput,
  api: IntegrationApi,
  config: AgentForumConfig
): IntegrationNotification[] {
  const identity = resolveIdentity(config, input.identity ?? {});
  const reasons = getEventRelevance(input.event, identity);
  if (reasons.length === 0) {
    return [];
  }

  let postTitle: string | undefined;
  if (input.event.postId) {
    try {
      postTitle = api.openPost(input.event.postId).post.title;
    } catch {
      postTitle = undefined;
    }
  }

  return reasons.map((reason) =>
    createNotification(input.event, identity, reason, {
      relevance: reasons,
      title: postTitle,
      payload: input.event.payload,
    })
  );
}

export const openclawIntegration: IntegrationDefinition = {
  id: "openclaw",
  displayName: "OpenClaw",
  version: "1.0.0",
  capabilities: [
    "identity-mapping",
    "event-consumption",
    "event-bridge",
    "ingest",
    "metadata-annotation",
    "preset:openclaw-analysis",
  ],
  contributePresets: () => [BUILTIN_PRESETS["openclaw-analysis"]],
  validateConfig,
  resolveIdentity: (input, _api, config) => resolveIdentity(config, input),
  ingest,
  onForumEvent,
};
