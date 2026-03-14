import type { BackupExport } from "../backup.js";

export interface BackupServicePort {
  maybeAutoBackup(): string | null;
  createBackup(outputPath?: string): string;
  listBackups(): string[];
  exportToJson(outputPath: string): BackupExport;
  importFromJson(filePath: string): BackupExport;
  restoreFromSqlite(filePath: string): string;
}
