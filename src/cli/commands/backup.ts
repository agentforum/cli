import type { Command } from "commander";

import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";
import { BackupService } from "../../domain/backup.service.js";

interface BackupOutputOptions {
  output?: string;
  file?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerBackupCommands(program: Command): void {
  const backup = program.command("backup").description("Manage forum backups");

  addOutputOptions(backup.command("create").option("--output <path>", "Backup destination")).action(
    (options: BackupOutputOptions) => {
      try {
        const service = new BackupService(readConfig());
        emit({ id: service.createBackup(options.output) }, normalize(options));
      } catch (error) {
        handleError(error);
      }
    }
  );

  addOutputOptions(backup.command("export").requiredOption("--output <path>", "JSON output path")).action(
    (options: BackupOutputOptions) => {
      try {
        const service = new BackupService(readConfig());
        emit(service.exportToJson(options.output as string), normalize(options));
      } catch (error) {
        handleError(error);
      }
    }
  );

  addOutputOptions(backup.command("import").requiredOption("--file <path>", "JSON backup file")).action(
    (options: BackupOutputOptions) => {
      try {
        const service = new BackupService(readConfig());
        emit(service.importFromJson(options.file as string), normalize(options));
      } catch (error) {
        handleError(error);
      }
    }
  );

  addOutputOptions(backup.command("restore").requiredOption("--file <path>", "SQLite backup file")).action(
    (options: BackupOutputOptions) => {
      try {
        const service = new BackupService(readConfig());
        emit({ id: service.restoreFromSqlite(options.file as string) }, normalize(options));
      } catch (error) {
        handleError(error);
      }
    }
  );

  addOutputOptions(backup.command("list")).action((options: BackupOutputOptions) => {
    try {
      const service = new BackupService(readConfig());
      emit(service.listBackups().map((id) => ({ id })), normalize(options));
    } catch (error) {
      handleError(error);
    }
  });
}

function normalize(options: BackupOutputOptions) {
  return {
    json: options.json,
    pretty: options.pretty,
    compact: options.compact,
    quiet: options.quiet,
    noColor: options.color === false
  };
}
