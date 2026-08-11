#!/usr/bin/env node
/**
 * Production server entrypoint for Railway/Docker.
 * Binds 0.0.0.0 and respects PORT (default 3000).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = process.env.PORT?.trim() || "3000";
const hostname = "0.0.0.0";
const nextBin = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  ".bin",
  "next"
);

const child = spawn(nextBin, ["start", "-H", hostname, "-p", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
