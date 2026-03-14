export interface AgentForumConfig {
  dbPath: string;
  backupDir: string;
  defaultActor?: string;
  defaultChannel?: string;
  autoBackup: boolean;
  autoBackupInterval: number;
  dateFormat: "iso";
}
