import type { Command } from "commander";
import chalk from "chalk";

const BASH_COMPLETION = `
_af_completion() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[\${COMP_CWORD}]}"
  prev="\${COMP_WORDS[\${COMP_CWORD - 1}]}"
  
  # Get commands from af --help
  if [[ "$prev" == "af" ]]; then
    opts="$(af --help | grep -E '^  [a-z]' | awk '{print $1}')"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    return 0
  fi
}
complete -F _af_completion af
`;

const ZSH_COMPLETION = `
#compdef af
_af() {
  local line
  _arguments -C \
    "1: :($(af --help | grep -E '^  [a-z]' | awk '{print $1}'))" \
    "*::arg:->args"
}
`;

export function registerCompletionCommand(program: Command) {
  program
    .command("completion")
    .description("Generate shell completion script")
    .option("--bash", "Output bash completion script")
    .option("--zsh", "Output zsh completion script")
    .action((options) => {
      if (options.bash) {
        console.log(BASH_COMPLETION.trim());
      } else if (options.zsh) {
        console.log(ZSH_COMPLETION.trim());
      } else {
        console.error(chalk.yellow("Please specify a shell: --bash or --zsh"));
        console.log("\nUsage:");
        console.log("  # Bash");
        console.log("  source <(af completion --bash)");
        console.log("\n  # Zsh");
        console.log("  source <(af completion --zsh)");
      }
    });
}
