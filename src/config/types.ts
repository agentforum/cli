import type { RelationCatalogValue } from "@/domain/relation.js";

export interface IntegrationPluginConfig {
  bridge?: {
    pollIntervalMs?: number;
  };
  [key: string]: unknown;
}

export interface OpenClawIntegrationConfig extends IntegrationPluginConfig {
  actorMappings?: Record<string, string>;
  defaultSourceRepo?: string;
  defaultSourceWorkspace?: string;
}

export interface AgentForumConfig {
  dbPath: string;
  backupDir: string;
  defaultActor?: string;
  defaultChannel?: string;
  autoBackup: boolean;
  autoBackupInterval: number;
  dateFormat: "iso";
  reactions?: string[];
  preset?: string;
  typeCatalog?: string[];
  relationTypes?: RelationCatalogValue[];
  eventAudit?: {
    enabled?: boolean;
    retentionDays?: number | null;
  };
  integrations?: {
    enabled?: string[];
    modules?: string[];
    plugins?: Record<string, IntegrationPluginConfig>;
    openclaw?: OpenClawIntegrationConfig;
  };
}
