#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

if (!existsSync(index)) throw new Error("Missing Sites build input: " + index);

const missingHandoffFiles = [worker, hosting].filter((file) => !existsSync(file));

if (missingHandoffFiles.length > 0) {
  if (process.env.NETLIFY) {
    console.warn("Sites handoff inputs are unavailable; skipping Sites server packaging on Netlify.");
  } else {
    throw new Error("Missing Sites build input: " + missingHandoffFiles[0]);
  }
} else {
  mkdirSync(path.join(dist, "server"), { recursive: true });
  mkdirSync(path.join(dist, ".openai"), { recursive: true });
  copyFileSync(worker, path.join(dist, "server", "index.js"));
  copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

  console.log("Prepared Sites build: dist/server/index.js and dist/.openai/hosting.json");
}
