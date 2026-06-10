import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { context } from "esbuild";
import { cleanDist, createBuildOptions } from "./build.mjs";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.resolve(artifactDir, "dist/index.mjs");

let serverProcess = null;
let shuttingDown = false;

async function stopServer() {
  if (!serverProcess) {
    return;
  }

  const runningProcess = serverProcess;
  serverProcess = null;

  await new Promise((resolve) => {
    runningProcess.once("exit", () => resolve());
    runningProcess.kill("SIGTERM");
  });
}

async function startServer() {
  await stopServer();

  serverProcess = spawn("node", ["--enable-source-maps", entryFile], {
    stdio: "inherit",
    env: process.env,
  });

  serverProcess.once("exit", (code, signal) => {
    if (!shuttingDown && signal == null && code && code !== 0) {
      console.error(`API server exited with code ${code}`);
    }
  });
}

async function main() {
  await cleanDist();

  const ctx = await context(
    createBuildOptions([
      {
        name: "restart-on-build",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0 || shuttingDown) {
              return;
            }

            await startServer();
          });
        },
      },
    ]),
  );

  const shutdown = async () => {
    shuttingDown = true;
    await ctx.dispose();
    await stopServer();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await ctx.watch();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
