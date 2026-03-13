import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // nueva funcionalidad
        "fix",      // corrección de bug
        "docs",     // solo documentación
        "style",    // formato, espacios, sin lógica
        "refactor", // refactor sin fix ni feat
        "test",     // agregar o corregir tests
        "chore",    // tareas de mantenimiento (build, deps, config)
        "perf",     // mejora de performance
        "ci",       // cambios de CI/CD
        "revert",   // revertir un commit anterior
      ],
    ],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],
  },
};

export default config;
