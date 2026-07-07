#!/usr/bin/env node
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGuideStreamingAssets } from "./build-guide-streaming-assets.js";
import { buildPatientGraphBundles } from "./build-patient-graph-bundles.js";
import { syncAppVersion } from "./sync-app-version.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nestedGithubDir = path.join(rootDir, "github-ready-care-nova-ai");
const sourcePublicDir = path.join(rootDir, "public");
const githubPublicDir = existsSync(nestedGithubDir)
  ? path.join(nestedGithubDir, "public")
  : sourcePublicDir;

const githubRootIndex = existsSync(nestedGithubDir)
  ? path.join(nestedGithubDir, "index.html")
  : path.join(rootDir, "index.html");
const maxGithubFileBytes = 5 * 1024 * 1024;
const rootLauncherHtml = await readFile(path.join(rootDir, "index.html"), "utf8");

const githubProjectFiles = [
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "Dockerfile",
  "package.json",
  "PROJECT_FILES.md",
  "README.md",
  "release-check.cmd",
  "server.js",
  "start-care-nova-global.cmd",
  "start-care-nova.cmd",
  "start-vitaflow-global.cmd",
  "start-vitaflow.cmd"
];

const githubProjectDirs = [
  ".github",
  "data",
  "large-assets",
  "scripts",
  "src",
  "videos"
];

const githubRuntimeDataFiles = [
  "data/graph/patient-knowledge-graph.json",
  "data/memory/patient-memory.json",
  "data/records/patient-records.json",
  "data/training/agent-training-state.json",
  "data/external/external-knowledge-cache.json",
  "data/onedrive-mirror/graph/patient-knowledge-graph.json",
  "data/onedrive-mirror/memory/patient-memory.json",
  "data/onedrive-mirror/records/patient-records.json",
  "data/onedrive-mirror/training/agent-training-state.json",
  "data/onedrive-mirror/external/external-knowledge-cache.json",
  "data/onedrive-mirror/offline-medical-db.json",
  "data/onedrive-mirror/mirror-manifest.json"
];

await syncAppVersion(rootDir);
await buildGuideStreamingAssets({ rootDir, chunkBytes: 4 * 1024 * 1024 });

await rm(githubPublicDir, { recursive: true, force: true });
await mkdir(githubPublicDir, { recursive: true });
await cp(sourcePublicDir, githubPublicDir, { recursive: true, force: true });

if (existsSync(nestedGithubDir)) {
  await Promise.all(githubProjectFiles.map(async (fileName) => {
    const sourcePath = path.join(rootDir, fileName);
    const targetPath = path.join(nestedGithubDir, fileName);

    if (existsSync(sourcePath)) {
      await copyFile(sourcePath, targetPath);
    }
  }));

  await Promise.all(githubProjectDirs.map(async (dirName) => {
    const sourcePath = path.join(rootDir, dirName);
    const targetPath = path.join(nestedGithubDir, dirName);

    if (existsSync(sourcePath)) {
      await rm(targetPath, { recursive: true, force: true });
      await cp(sourcePath, targetPath, { recursive: true, force: true });
    }
  }));
}

await Promise.all([
  writeFile(path.join(rootDir, "index.html"), rootLauncherHtml, "utf8"),
  writeFile(githubRootIndex, rootLauncherHtml, "utf8")
]);

if (existsSync(nestedGithubDir)) {
  await Promise.all(githubRuntimeDataFiles.map((fileName) => (
    rm(path.join(nestedGithubDir, fileName), { force: true })
  )));

  const patientBundleResult = await buildPatientGraphBundles({
    rootDir,
    targetRoot: nestedGithubDir,
    removeSourceShards: true,
    maxBundleBytes: maxGithubFileBytes,
    targetPartCount: 11
  });

  const prunedFiles = await pruneOversizedFiles(nestedGithubDir, maxGithubFileBytes);

  if (prunedFiles.length) {
    const largeAssetDir = path.join(nestedGithubDir, "large-assets");
    await mkdir(largeAssetDir, { recursive: true });
    await writeFile(
      path.join(largeAssetDir, "README.md"),
      [
        "# Large Local Media",
        "",
        "Oversized generated video/audio render files are kept out of this GitHub-ready package so every uploaded file stays below 5 MB.",
        "The app remains functional on GitHub Pages through the built-in slide guide and local-first workspace.",
        "Restore local media from the main project folder when running a full local demo.",
        "",
        "Pruned files:",
        ...prunedFiles.map((file) => `- ${file}`)
      ].join("\n") + "\n",
      "utf8"
    );
  }

  if (!patientBundleResult.skipped) {
    console.log(`Bundled ${patientBundleResult.patientCount} patient graph shard(s) into ${patientBundleResult.partCount} GitHub-safe file(s).`);
  }
} else {
  const patientBundleResult = await buildPatientGraphBundles({
    rootDir,
    targetRoot: rootDir,
    removeSourceShards: true,
    maxBundleBytes: maxGithubFileBytes,
    targetPartCount: 11
  });

  if (!patientBundleResult.skipped) {
    console.log(`Bundled ${patientBundleResult.patientCount} patient graph shard(s) into ${patientBundleResult.partCount} GitHub-safe file(s).`);
  }
}

console.log("GitHub app package built with frontend, backend, scripts, media, and launcher files.");

async function pruneOversizedFiles(targetDir, maxBytes) {
  const removed = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") {
          continue;
        }

        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const details = await stat(fullPath);

      if (details.size > maxBytes) {
        removed.push(path.relative(targetDir, fullPath).replace(/\\/g, "/"));
        await rm(fullPath, { force: true });
      }
    }
  }

  await walk(targetDir);
  return removed.sort();
}
