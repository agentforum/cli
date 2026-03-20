import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";

import chalk from "chalk";
import type { Command } from "commander";
import pkg from "../../package.json" with { type: "json" };

import { GLOBAL_CONFIG_DEFAULTS, LOCAL_CONFIG_DEFAULTS } from "./commands/config.js";
import { findConfigSource, globalConfigPath } from "@/config.js";
import { AgentForumError } from "@/domain/types.js";

const LOGO = String.raw`
    _                    _   _____                        
   / \   __ _  ___ _ __ | |_|  ___|__  _ __ _   _ _ __ ___
  / _ \ / _\` |/ _ \ '_ \| __| |_ / _ \| '__| | | | '_ \` _ \
 / ___ \ (_| |  __/ | | | |_|  _| (_) | |  | |_| | | | | | |
/_/   \_\__, |\___|_| |_|\__|_|  \___/|_|   \__,_|_| |_| |_|
        |___/                                               
`;

type ConfigScope = "local" | "global";

interface OnboardingAnswers {
  scope: ConfigScope;
  actor: string;
  channel: string;
  autoBackup: boolean;
}

export function createOnboardingConfig(
  scope: ConfigScope,
  actor: string,
  channel: string,
  autoBackup: boolean
): Record<string, unknown> {
  return {
    ...(scope === "local" ? LOCAL_CONFIG_DEFAULTS : GLOBAL_CONFIG_DEFAULTS),
    defaultActor: actor,
    defaultChannel: channel,
    autoBackup,
  };
}

export function onboardingVersionLabel(): string {
  return `v${pkg.version}`;
}

export function shouldAutoLaunchOnboardingForState(options: {
  argv: string[];
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  configScope: "local" | "global" | "default";
}): boolean {
  if (options.argv.length > 2) return false;
  if (!options.stdinIsTTY || !options.stdoutIsTTY) return false;
  return options.configScope === "default";
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Run the interactive first-run setup")
    .option("--overwrite", "Overwrite the config file if it already exists")
    .action(async (options: { overwrite?: boolean }) => {
      await runInteractiveOnboarding({ overwrite: options.overwrite ?? false });
    });
}

export function shouldAutoLaunchOnboarding(argv: string[]): boolean {
  return shouldAutoLaunchOnboardingForState({
    argv,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    configScope: findConfigSource(process.cwd()).scope,
  });
}

export async function runInteractiveOnboarding(options: { overwrite: boolean }): Promise<void> {
  const rl = createInterface({ input, output });

  try {
    await showWelcome(rl);
    const answers: OnboardingAnswers = {
      scope: await askScope(rl),
      actor: await askActor(rl),
      channel: await askChannel(rl),
      autoBackup: await askAutoBackup(rl),
    };

    const targetPath =
      answers.scope === "local" ? resolve(process.cwd(), ".afrc") : globalConfigPath();
    const config = createOnboardingConfig(
      answers.scope,
      answers.actor,
      answers.channel,
      answers.autoBackup
    );

    await reviewAndWrite(rl, {
      targetPath,
      config,
      overwrite: options.overwrite,
      scope: answers.scope,
    });
  } finally {
    rl.close();
  }
}

async function showWelcome(rl: ReturnType<typeof createInterface>): Promise<void> {
  for (;;) {
    renderScreen({
      step: "Welcome",
      title: "Set up AgentForum in under a minute",
      body: [
        chalk.white("Shared memory for agents."),
        chalk.gray("This quick setup will create a config file and set your default identity."),
        "",
        chalk.gray("Press Enter to continue or type q to quit."),
      ],
    });

    const answer = await prompt(rl, chalk.cyan("> "));
    if (answer === "") return;
  }
}

async function askScope(rl: ReturnType<typeof createInterface>): Promise<ConfigScope> {
  for (;;) {
    renderScreen({
      step: "1 of 4",
      title: "Choose where to store your config",
      body: [
        `${chalk.cyan("1")} ${chalk.white("Project config")} ${chalk.gray("(.afrc in this directory)")} ${chalk.green("(recommended)")}`,
        `${chalk.cyan("2")} ${chalk.white("Global config")} ${chalk.gray("(~/.afrc)")}`,
        "",
        chalk.gray("Project config is the safest default for a new workspace."),
      ],
    });

    const answer = await prompt(rl, chalk.cyan("Select [1]: "));
    if (answer === "" || answer === "1" || answer === "project" || answer === "local") {
      return "local";
    }
    if (answer === "2" || answer === "global") {
      return "global";
    }
  }
}

async function askActor(rl: ReturnType<typeof createInterface>): Promise<string> {
  for (;;) {
    renderScreen({
      step: "2 of 4",
      title: "Set your default actor",
      body: [
        chalk.white("This identity is used when you omit ") +
          chalk.cyan("--actor") +
          chalk.white(" in commands."),
        "",
        chalk.gray("Examples: claude:backend, gpt:frontend, human:operator"),
      ],
    });

    const answer = await prompt(rl, chalk.cyan("Actor: "), false);
    if (answer.length >= 3) return answer;
  }
}

async function askChannel(rl: ReturnType<typeof createInterface>): Promise<string> {
  for (;;) {
    renderScreen({
      step: "3 of 4",
      title: "Choose your default channel",
      body: [
        chalk.white("This channel is used when you omit ") +
          chalk.cyan("--channel") +
          chalk.white(" in commands."),
        "",
        chalk.gray("Common values: general, backend, frontend, ops"),
      ],
    });

    const answer = await prompt(rl, chalk.cyan("Channel [general]: "), false);
    if (answer === "") return "general";
    if (answer.length >= 2) return answer;
  }
}

async function askAutoBackup(rl: ReturnType<typeof createInterface>): Promise<boolean> {
  for (;;) {
    renderScreen({
      step: "4 of 4",
      title: "Enable automatic backups",
      body: [
        chalk.white("AgentForum can create periodic SQLite backups for safety."),
        "",
        chalk.gray("Recommended for active shared forums."),
      ],
    });

    const answer = await prompt(rl, chalk.cyan("Enable auto-backup? [Y/n]: "));
    if (answer === "" || answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
  }
}

async function reviewAndWrite(
  rl: ReturnType<typeof createInterface>,
  options: {
    targetPath: string;
    config: Record<string, unknown>;
    overwrite: boolean;
    scope: ConfigScope;
  }
): Promise<void> {
  const { targetPath, config, overwrite, scope } = options;
  const configExists = existsSync(targetPath);

  for (;;) {
    renderScreen({
      step: "Review",
      title: "Review your setup",
      body: [
        `${chalk.gray("Scope:")} ${chalk.white(scope)}`,
        `${chalk.gray("Path:")} ${chalk.white(targetPath)}`,
        `${chalk.gray("Actor:")} ${chalk.white(String(config.defaultActor))}`,
        `${chalk.gray("Channel:")} ${chalk.white(String(config.defaultChannel))}`,
        `${chalk.gray("Auto-backup:")} ${chalk.white(String(config.autoBackup))}`,
        "",
        configExists && !overwrite
          ? chalk.yellow(
              "A config file already exists. Writing now will replace it only if you confirm."
            )
          : chalk.gray("Press Enter to write the config, or type q to cancel."),
      ],
    });

    const answer = await prompt(
      rl,
      chalk.cyan(configExists ? "Write config? [y/N]: " : "Write config? [Y/n]: ")
    );

    const confirmed = configExists
      ? answer === "y" || answer === "yes"
      : answer === "" || answer === "y" || answer === "yes";
    if (!confirmed) {
      if (configExists) throw new AgentForumError("Setup cancelled.", 0);
      continue;
    }

    if (configExists && !overwrite) {
      const existing = JSON.parse(readFileSync(targetPath, "utf8")) as Record<string, unknown>;
      renderScreen({
        step: "Overwrite",
        title: "Existing config found",
        body: [
          `${chalk.gray("Path:")} ${chalk.white(targetPath)}`,
          "",
          chalk.gray("Current contents:"),
          chalk.white(JSON.stringify(existing, null, 2)),
          "",
          chalk.yellow("Type overwrite to replace this file, or press Enter to cancel."),
        ],
      });

      const overwriteAnswer = await prompt(rl, chalk.cyan("Confirm overwrite: "), false);
      if (overwriteAnswer !== "overwrite") {
        throw new AgentForumError("Setup cancelled.", 0);
      }
    }

    writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    showSuccess(targetPath);
    return;
  }
}

function showSuccess(targetPath: string): void {
  renderScreen({
    step: "Ready",
    title: "AgentForum is configured",
    body: [
      `${chalk.gray("Config written to:")} ${chalk.white(targetPath)}`,
      "",
      chalk.white("Next steps:"),
      chalk.cyan('  af post --type note --title "Hello" --body "AgentForum is ready"'),
      chalk.cyan("  af browse"),
      chalk.cyan("  af help"),
    ],
  });
}

function renderScreen(options: { step: string; title: string; body: string[] }): void {
  process.stdout.write("\x1Bc");
  process.stdout.write(`${chalk.cyan(LOGO.trimEnd())}\n`);
  process.stdout.write(
    `${chalk.gray("AgentForum Setup")} ${chalk.gray("·")} ${chalk.white(options.step)} ${chalk.gray("·")} ${chalk.cyan(onboardingVersionLabel())}\n`
  );
  process.stdout.write(`${chalk.gray("═".repeat(72))}\n`);
  process.stdout.write(`${chalk.bold.white(options.title)}\n`);
  process.stdout.write(`${chalk.gray("─".repeat(72))}\n`);
  process.stdout.write(`${options.body.join("\n")}\n`);
  process.stdout.write(`${chalk.gray("─".repeat(72))}\n\n`);
}

async function prompt(
  rl: ReturnType<typeof createInterface>,
  label: string,
  allowQuit = true
): Promise<string> {
  try {
    const answer = (await rl.question(label)).trim().toLowerCase();
    if (allowQuit && (answer === "q" || answer === "quit")) {
      throw new AgentForumError("Setup cancelled.", 0);
    }
    return answer;
  } catch (error) {
    if (isAbortError(error)) {
      throw new AgentForumError("Setup cancelled.", 0);
    }
    throw error;
  }
}

function isAbortError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ABORT_ERR"
  );
}
