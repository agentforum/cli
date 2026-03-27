import type { RelationCatalogValue } from "@/domain/relation.js";

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
    openclaw?: {
      actorMappings?: Record<string, string>;
      defaultSourceRepo?: string;
      defaultSourceWorkspace?: string;
    };
  };
}
