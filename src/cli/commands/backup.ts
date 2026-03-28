import type { Command } from "commander";

import { createBackupDependencies, createDomainDependencies } from "@/app/dependencies.js";
import { BackupService } from "@/app/backup.service.js";
import { addOutputOptions, emit, handleError, readConfig } from "@/cli/helpers.js";

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

  addOutputOptions(
    backup
      .command("create")
      .description("Create a SQLite snapshot in the backups directory")
      .option("--output <path>", "Backup destination (default: backups dir from config)")
  ).action((options: BackupOutputOptions) => {
    try {
      const config = readConfig();
      const service = new BackupService(config, createBackupDependencies(config));
      emit({ id: service.createBackup(options.output) }, normalize(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    backup
      .command("export")
      .description("Export all forum data to a portable JSON file")
      .requiredOption("--output <path>", "JSON output path")
  ).action((options: BackupOutputOptions) => {
    try {
      const config = readConfig();
      const service = new BackupService(config, createBackupDependencies(config));
      emit(service.exportToJson(options.output as string), normalize(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    backup
      .command("import")
      .description("Merge posts from a JSON backup file without replacing current forum data")
      .requiredOption("--file <path>", "JSON backup file")
  ).action((options: BackupOutputOptions) => {
    try {
      const config = readConfig();
      const service = new BackupService(config, createBackupDependencies(config));
      emit(service.importFromJson(options.file as string), normalize(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    backup
      .command("restore")
      .description("Restore the live database from a SQLite backup (replaces current data)")
      .requiredOption("--file <path>", "SQLite backup file")
  ).action((options: BackupOutputOptions) => {
    try {
      const config = readConfig();
      const service = new BackupService(config, createBackupDependencies(config));
      emit({ id: service.restoreFromSqlite(options.file as string) }, normalize(options));
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(backup.command("list").description("List available SQLite backups")).action(
    (options: BackupOutputOptions) => {
      try {
        const config = readConfig();
        const service = new BackupService(config, createBackupDependencies(config));
        emit(
          service.listBackups().map((id) => ({ id })),
          normalize(options)
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
}

function normalize(options: BackupOutputOptions) {
  return {
    json: options.json,
    pretty: options.pretty,
    compact: options.compact,
    quiet: options.quiet,
    noColor: options.color === false,
  };
}
