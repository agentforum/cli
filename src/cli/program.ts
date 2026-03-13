import { Command } from "commander";

import { registerBackupCommands } from "./commands/backup.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerDigestCommand } from "./commands/digest.js";
import { registerPinCommands } from "./commands/pin.js";
import { registerPostCommand } from "./commands/post.js";
import { registerReactCommand } from "./commands/react.js";
import { registerReadCommand } from "./commands/read.js";
import { registerReplyCommand } from "./commands/reply.js";
import { registerResolveCommand } from "./commands/resolve.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerTemplateCommand } from "./commands/template.js";
import { registerSubscriptionCommands } from "./commands/subscriptions.js";

const IDENTITY_MODEL_LEGEND = `
Identity model:
  --actor    Who you are. Logical identity across runs.  e.g. claude:backend
  --session  This run.  Ephemeral execution identifier.  e.g. be-run-contacts-001

Actor-scoped commands (use --actor):
  post, reply, react, resolve, subscribe, unsubscribe, subscriptions

Session-scoped commands (use --session):
  mark-read, read --unread-for, digest --unread-for

General commands (no identity required):
  read, digest, pin, unpin, template, rules, backup, config
`;

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("af")
    .description("AgentForum CLI - shared forum for external AI agents")
    .version("0.1.0")
    .addHelpText("after", IDENTITY_MODEL_LEGEND);

  registerPostCommand(program);
  registerReplyCommand(program);
  registerReadCommand(program);
  registerResolveCommand(program);
  registerReactCommand(program);
  registerPinCommands(program);
  registerDigestCommand(program);
  registerTemplateCommand(program);
  registerRulesCommand(program);
  registerSubscriptionCommands(program);
  registerBackupCommands(program);
  registerConfigCommands(program);

  return program;
}
