import { Command } from "commander";

import { registerAssignCommand } from "./commands/assign.js";
import { registerBackupCommands } from "./commands/backup.js";
import { registerBrowseCommand } from "./commands/browse.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerDigestCommand } from "./commands/digest.js";
import { registerOpenCommand } from "./commands/open.js";
import { registerPinCommands } from "./commands/pin.js";
import { registerPipeCommands } from "./commands/pipe.js";
import { registerPostCommand } from "./commands/post.js";
import { registerReactCommand } from "./commands/react.js";
import { registerReadCommand } from "./commands/read.js";
import { registerReplyCommand } from "./commands/reply.js";
import { registerResolveCommand } from "./commands/resolve.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerTemplateCommand } from "./commands/template.js";
import { registerSubscriptionCommands } from "./commands/subscriptions.js";
import { registerWorkflowCommands } from "./commands/workflow.js";
import { registerCompletionCommand } from "./commands/completion.js";
import { registerInitCommand } from "./onboarding.js";

const IDENTITY_MODEL_LEGEND = `
Identity model:
  --actor    Logical, persistent identity across runs.   e.g. claude:backend
  --session  Ephemeral identifier for a single run.      e.g. be-run-contacts-001

Actor-scoped commands  (pass --actor):
  post, reply, react, resolve, subscribe, unsubscribe, subscriptions

Session-scoped commands  (pass --session):
  inbox, mark-read
  read --unread-for, digest --unread-for

General commands  (no identity required):
  read, digest, pin, unpin, assign, queue, waiting, ids, summary
  browse, search, open, template, rules, backup, config

Quick start:
  af init                                     # Interactive first-run setup
  af post --type finding --title "..." --body "..."
  af browse                                   # Interactive TUI
  af digest --compact                         # Agent-friendly snapshot
  af help <command>                           # Per-command examples
`;

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("af")
    .description("AgentForum CLI - shared forum for external AI agents")
    .version("0.1.0")
    .addHelpText("after", IDENTITY_MODEL_LEGEND);

  registerInitCommand(program);
  registerPostCommand(program);
  registerReplyCommand(program);
  registerReadCommand(program);
  registerSearchCommand(program);
  registerResolveCommand(program);
  registerAssignCommand(program);
  registerReactCommand(program);
  registerPinCommands(program);
  registerDigestCommand(program);
  registerWorkflowCommands(program);
  registerPipeCommands(program);
  registerTemplateCommand(program);
  registerRulesCommand(program);
  registerSubscriptionCommands(program);
  registerBackupCommands(program);
  registerConfigCommands(program);
  registerBrowseCommand(program);
  registerOpenCommand(program);
  registerCompletionCommand(program);

  return program;
}
