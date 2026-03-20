import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const distRoot = resolve(repoRoot, "dist");
const binRoot = resolve(distRoot, "bin");
const releasesRoot = resolve(distRoot, "releases");

const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const version = packageJson.version;

const platformMap = {
  linux: "linux",
  darwin: "macos",
  win32: "windows",
};

const archMap = {
  x64: "x64",
  arm64: "arm64",
};

const platform = platformMap[process.platform];
const arch = archMap[process.arch];

if (!platform || !arch) {
  throw new Error(`Unsupported platform/arch: ${process.platform}/${process.arch}`);
}

const bundleName = `agentforum-${platform}-${arch}`;
const bundleRoot = resolve(binRoot, bundleName);
const appRoot = resolve(bundleRoot, "app");
const runtimeRoot = resolve(bundleRoot, "runtime");
const launcherName = process.platform === "win32" ? "af.cmd" : "af";
const nodeBinaryName = process.platform === "win32" ? "node.exe" : "node";
const archivePath = resolve(releasesRoot, `${bundleName}-v${version}.tar.gz`);

rmSync(bundleRoot, { force: true, recursive: true });
mkdirSync(appRoot, { recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(releasesRoot, { recursive: true });

cpSync(process.execPath, resolve(runtimeRoot, nodeBinaryName));
if (process.platform !== "win32") {
  chmodSync(resolve(runtimeRoot, nodeBinaryName), 0o755);
}

for (const relativePath of ["dist/cli", "node_modules", "package.json", ".afrc.example", "README.md"]) {
  cpSync(resolve(repoRoot, relativePath), resolve(appRoot, relativePath), { recursive: true });
}

if (process.platform === "win32") {
  writeFileSync(
    resolve(bundleRoot, launcherName),
    [
      "@echo off",
      "setlocal",
      'set SCRIPT_DIR=%~dp0',
      '"%SCRIPT_DIR%runtime\\node.exe" "%SCRIPT_DIR%app\\dist\\cli\\index.js" %*',
      "",
    ].join("\r\n")
  );
} else {
  writeFileSync(
    resolve(bundleRoot, launcherName),
    [
      "#!/usr/bin/env sh",
      'set -eu',
      'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"',
      'exec "$SCRIPT_DIR/runtime/node" "$SCRIPT_DIR/app/dist/cli/index.js" "$@"',
      "",
    ].join("\n")
  );
  chmodSync(resolve(bundleRoot, launcherName), 0o755);
}

const tarResult = spawnSync(
  "tar",
  ["-czf", archivePath, "-C", binRoot, bundleName],
  { cwd: repoRoot, stdio: "inherit" }
);

if (tarResult.status !== 0) {
  throw new Error(`Failed to create archive ${archivePath}`);
}

console.log(`Created bundle: ${bundleRoot}`);
console.log(`Created archive: ${archivePath}`);
