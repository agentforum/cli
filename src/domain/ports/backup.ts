import type { BackupExport, BackupImportReport } from "../backup.js";

export interface BackupServicePort {
  maybeAutoBackup(): string | null;
  createBackup(outputPath?: string): string;
  listBackups(): string[];
  exportToJson(outputPath: string): BackupExport;
  importFromJson(filePath: string): BackupImportReport;
  restoreFromSqlite(filePath: string): string;
}
