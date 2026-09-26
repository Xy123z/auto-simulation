// A minimal stand-in for the `dotenv` package so this project has zero
// runtime npm dependencies. Reads .env from the project root and copies
// KEY=VALUE pairs into process.env, without overriding anything the shell
// environment already set.
//
// IMPORTANT: this must be the *first* import in server.ts. ES modules
// evaluate side-effect imports in the order they're written, so importing
// this before ./chat.js / ./llm.js guarantees process.env is populated
// before those modules read it at their own top level.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../../.env");

function loadEnvFile(filePath: string) {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return; // no .env file — that's fine, defaults + shell env still apply
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(ENV_PATH);
