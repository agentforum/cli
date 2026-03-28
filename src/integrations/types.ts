import type { AgentForumConfig } from "@/config/types.js";
import type { AuditEventRecord } from "@/domain/event.js";
import type { PresetRecord } from "@/domain/preset.js";
import type { IntegrationApi } from "@/integrations/api.js";

export interface IntegrationHealth {
  ok: boolean;
  warnings: string[];
  errors: string[];
}

export interface IntegrationIdentity {
  actor: string | null;
  session: string | null;
  metadata?: Record<string, unknown>;
}

export interface IntegrationResolveIdentityInput {
  actor?: string | null;
  session?: string | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface IntegrationIngestInput {
  action: string;
  operationKey?: string;
  identity?: IntegrationResolveIdentityInput;
  payload?: Record<string, unknown>;
}

export interface IntegrationBridgeInput {
  event: AuditEventRecord;
  identity?: IntegrationResolveIdentityInput;
}

export interface IntegrationNotification {
  kind: string;
  reason: string;
  targetActor?: string | null;
  targetSession?: string | null;
  payload: Record<string, unknown>;
}

export interface IntegrationIngestResult {
  action: string;
  operationKey?: string;
  identity?: IntegrationIdentity;
  duplicated?: boolean;
  replayed?: boolean;
  entity?: unknown;
  entities?: Record<string, unknown>;
  notifications?: IntegrationNotification[];
}

export interface IntegrationDefinition {
  id: string;
  displayName: string;
  version: string;
  capabilities: string[];
  contributePresets?: () => PresetRecord[];
  validateConfig?: (config: AgentForumConfig) => IntegrationHealth;
  resolveIdentity?: (
    input: IntegrationResolveIdentityInput,
    api: IntegrationApi,
    config: AgentForumConfig
  ) => IntegrationIdentity;
  ingest?: (
    input: IntegrationIngestInput,
    api: IntegrationApi,
    config: AgentForumConfig
  ) => Promise<IntegrationIngestResult> | IntegrationIngestResult;
  onForumEvent?: (
    input: IntegrationBridgeInput,
    api: IntegrationApi,
    config: AgentForumConfig
  ) => Promise<IntegrationNotification[]> | IntegrationNotification[];
}
